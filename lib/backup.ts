// Backups of a company's database. The data lives only on this PC, so a dated copy is the safety net:
//   * one automatic copy the first time a company is opened each day,
//   * "Back up now" in Settings,
//   * a copy of whatever is there before a restore replaces it.
// Files are PGlite data-directory archives (.tar.gz) in <data dir>\backups\<company>\. Copy that
// folder to a USB stick or OneDrive to keep a copy off the PC.

import fs from "fs";
import path from "path";
import type { PGlite } from "@electric-sql/pglite";
import { dataDir } from "./data-dir";
import type { Company } from "./companies";

export type BackupInfo = { file: string; bytes: number; at: string };

const KEEP = 40;
const NAME = /^[a-z0-9-]+_\d{4}-\d{2}-\d{2}_\d{4}[a-z-]*\.tar\.gz$/;

export const backupsDir = (slug: string) => path.join(dataDir(), "backups", slug);

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function listBackups(slug: string): BackupInfo[] {
  const dir = backupsDir(slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => NAME.test(f))
    .map((file) => {
      const s = fs.statSync(path.join(dir, file));
      return { file, bytes: s.size, at: s.mtime.toISOString() };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Absolute path of a backup file, or null when the name is not one of ours or the file is gone. */
export function backupPath(slug: string, file: string): string | null {
  if (!NAME.test(file) || !file.startsWith(`${slug}_`)) return null;
  const full = path.join(backupsDir(slug), file);
  return fs.existsSync(full) ? full : null;
}

function prune(slug: string): void {
  for (const old of listBackups(slug).slice(KEEP)) {
    try {
      fs.unlinkSync(path.join(backupsDir(slug), old.file));
    } catch {
      // ignore
    }
  }
}

/** @param label Appended to the file name, e.g. "-before-restore". */
export async function createBackup(db: PGlite, company: Company, label = ""): Promise<BackupInfo> {
  const dir = backupsDir(company.slug);
  fs.mkdirSync(dir, { recursive: true });
  const blob = await db.dumpDataDir("gzip");
  const file = `${company.slug}_${stamp()}${label}.tar.gz`;
  fs.writeFileSync(path.join(dir, file), Buffer.from(await blob.arrayBuffer()));
  prune(company.slug);
  const s = fs.statSync(path.join(dir, file));
  return { file, bytes: s.size, at: s.mtime.toISOString() };
}

/** The once-a-day copy. Never lets a failed backup stop the app from opening. */
export async function autoBackup(db: PGlite, company: Company): Promise<void> {
  try {
    const today = stamp().slice(0, 10);
    if (listBackups(company.slug).some((b) => b.file.startsWith(`${company.slug}_${today}`))) return;
    await createBackup(db, company);
  } catch {
    // a backup problem is reported when someone backs up by hand; it must not block the books
  }
}
