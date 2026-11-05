// Where the desktop app keeps its files, and where the schema/seed files it ships with live.

import os from "os";
import path from "path";

/** Folder holding everything the desktop app keeps on this PC (company databases, registry, secret). */
export function dataDir(): string {
  if (process.env.ACCOUNTS_DATA_DIR) return process.env.ACCOUNTS_DATA_DIR;
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), ".local", "share");
  return path.join(base, "net.algarvebuilders.accounts-manager");
}

/** Where the schema/seed files are: the project folder in dev, the bundle's resources in the installed app. */
export function resourcesDir(): string {
  return process.env.ACCOUNTS_RESOURCES_DIR || process.cwd();
}
