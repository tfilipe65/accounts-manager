"use server";

// Backup and restore for the open company. Admin only. See lib/backup.ts for what a backup is.

import fs from "fs";
import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getCurrentCompany } from "@/lib/current-company";
import { closeCompanyDatabase, openCompanyDatabase, PGLITE_OPTIONS } from "@/lib/db";
import { backupPath, createBackup } from "@/lib/backup";
import { companyDbDir } from "@/lib/companies";

type Result = { error?: string; success?: boolean; message?: string };

async function company() {
  const c = await getCurrentCompany();
  if (!c) throw new Error("Choose a company first.");
  return c;
}

export async function backupNowAction(_prev: Result | undefined, _fd: FormData): Promise<Result> {
  try {
    const admin = await requireAdminForAction();
    const c = await company();
    const info = await createBackup(await openCompanyDatabase(c), c);
    await writeAudit(admin, "backup.create", info.file);
    revalidatePath("/settings");
    return { success: true, message: `Saved ${info.file}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not make the backup." };
  }
}

/** Replace the open company's data with a backup. What is there now is backed up first. */
export async function restoreBackupAction(file: string, _prev: Result | undefined, _fd: FormData): Promise<Result> {
  try {
    const admin = await requireAdminForAction();
    const c = await company();
    const source = backupPath(c.slug, file);
    if (!source) return { error: "That backup file is no longer there." };

    await createBackup(await openCompanyDatabase(c), c, "-before-restore");
    await closeCompanyDatabase(c.slug);

    const dir = companyDbDir(c.slug);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const archive = new File([fs.readFileSync(source)], file, { type: "application/gzip" });
    const restored = new PGlite(dir, { ...PGLITE_OPTIONS, loadDataDir: archive });
    await restored.waitReady;
    await restored.close();

    await writeAudit(admin, "backup.restore", file);
    revalidatePath("/", "layout");
    return { success: true, message: `Restored ${file}. Everything now shows the data as it was then.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not restore the backup." };
  }
}
