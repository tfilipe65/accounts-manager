"use server";

// Sample data and "start fresh". See lib/sample-data.ts. Loading sample data and clearing a company are
// both preceded by an automatic backup, so neither is a one-way door.

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getCurrentCompany } from "@/lib/current-company";
import { listCompanies } from "@/lib/companies";
import { getMaster } from "@/lib/master-admin";
import { clearCompanyData, loadSampleData } from "@/lib/sample-data";

type Result = { error?: string; success?: boolean; message?: string };

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export async function loadSampleDataAction(_prev: Result | undefined, _fd: FormData): Promise<Result> {
  try {
    const admin = await requireAdminForAction();
    const company = await getCurrentCompany();
    if (!company) return { error: "Choose a company first." };
    const summary = await loadSampleData(company);
    await writeAudit(admin, "sample-data.load", company.name);
    revalidatePath("/", "layout");
    return { success: true, message: `Loaded: ${summary}.` };
  } catch (e) {
    return { error: message(e, "Could not load the sample data.") };
  }
}

export async function startFreshAction(_prev: Result | undefined, _fd: FormData): Promise<Result> {
  try {
    const admin = await requireAdminForAction();
    const company = await getCurrentCompany();
    if (!company) return { error: "Choose a company first." };
    await clearCompanyData(company);
    await writeAudit(admin, "sample-data.clear", company.name);
    revalidatePath("/", "layout");
    return { success: true, message: "All entries and master data are cleared. A backup was kept in Settings > Backup." };
  } catch (e) {
    return { error: message(e, "Could not clear the data.") };
  }
}

/** From the company list: the master administrator fills every company that is still empty. */
export async function loadSampleDataAllAction(_prev: Result | undefined, _fd: FormData): Promise<Result> {
  if (!(await getMaster())) return { error: "Only the administrator can do this." };
  const done: string[] = [];
  const skipped: string[] = [];
  for (const company of listCompanies()) {
    try {
      await loadSampleData(company);
      done.push(company.name);
    } catch (e) {
      if (e instanceof Error && e.message.includes("already has entries")) skipped.push(company.name);
      else return { error: `${company.name}: ${message(e, "could not load")}` };
    }
  }
  revalidatePath("/companies");
  return {
    success: true,
    message: `Loaded into ${done.length ? done.join(", ") : "no company"}.${skipped.length ? ` Skipped (already have entries): ${skipped.join(", ")}.` : ""}`,
  };
}

/** From the company list: empty every company (each is backed up first). */
export async function startFreshAllAction(_prev: Result | undefined, _fd: FormData): Promise<Result> {
  if (!(await getMaster())) return { error: "Only the administrator can do this." };
  try {
    for (const company of listCompanies()) await clearCompanyData(company);
  } catch (e) {
    return { error: message(e, "Could not clear the data.") };
  }
  revalidatePath("/companies");
  return { success: true, message: "Every company is cleared. Each one was backed up first." };
}
