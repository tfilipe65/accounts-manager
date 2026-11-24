// Database entry point. The app is a desktop app: every company has its own embedded Postgres
// (PGlite) with its files on this PC, under
//   %LOCALAPPDATA%\net.algarvebuilders.accounts-manager\companies\<company>\db
// (override the base folder with ACCOUNTS_DATA_DIR). The company is the one in the `company`
// cookie (lib/companies.ts). There is no database server and nothing leaves the PC; lib/backup.ts
// keeps dated copies so the data can be put back.
//
// The schema is the files in db/migrations; they are applied to a company's database when it is
// first opened (and recorded in _migrations). A brand-new company database is filled once from
// db/seed.sql (the chart of accounts and defaults) plus db/profiles/<company>.sql when that exists;
// both are built by scripts/build-seed.mjs.

import type { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { resourcesDir } from "./data-dir";
import { getCurrentCompany } from "./current-company";
import { companyDbDir, type Company } from "./companies";
import { autoBackup } from "./backup";

// A result row: any set of named columns (the same loose shape the old Postgres driver used).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResultRow = { [column: string]: any };

/** What a transaction body gets: just `query`. */
export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

declare global {
  var __pgliteByCompany__: Map<string, Promise<PGlite>> | undefined;
}

// DATE columns (oid 1082) default to JS Date objects, which then round-trip through a timezone on
// every .toISOString()/.toLocaleDateString() call -- anywhere behind UTC silently shows the previous
// day for a plain calendar date. Every date in this schema (invoice dates, opening balances, ...) is
// a bare YYYY-MM-DD with no time or timezone, so keep it as the string Postgres already sends.
export const PGLITE_OPTIONS = { parsers: { 1082: (v: string) => v } };

async function applyMigrationsAndSeed(db: PGlite, company: Company): Promise<void> {
  await db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const applied = new Set((await db.query<{ name: string }>("SELECT name FROM _migrations")).rows.map((r) => r.name));

  const migDir = path.join(resourcesDir(), "db", "migrations");
  const files = fs.existsSync(migDir) ? fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort() : [];
  for (const file of files) {
    if (applied.has(file)) continue;
    // One exec = one implicit transaction, so a failing migration leaves nothing half-applied.
    await db.exec(fs.readFileSync(path.join(migDir, file), "utf8") + `\nINSERT INTO _migrations (name) VALUES ('${file}');`);
  }

  if (!applied.has("__seed__")) {
    const seedFile = path.join(resourcesDir(), "db", "seed.sql");
    if (fs.existsSync(seedFile)) {
      const profileFile = path.join(resourcesDir(), "db", "profiles", `${company.slug}.sql`);
      const profile = fs.existsSync(profileFile) ? fs.readFileSync(profileFile, "utf8") : "";
      const name = company.name.replace(/'/g, "''");
      // One exec: the chart of accounts, this company's name, its profile -- all or nothing.
      await db.exec(
        fs.readFileSync(seedFile, "utf8") +
          `\nUPDATE app_settings SET company_name = '${name}' WHERE id = 1;\n` +
          profile +
          `\nINSERT INTO _migrations (name) VALUES ('__seed__');`
      );
    }
  }
}

async function currentCompany(): Promise<Company> {
  const company = await getCurrentCompany();
  if (!company) throw new Error("NO_COMPANY: choose a company first.");
  return company;
}

// One open database per company, kept for the life of the server and opened on first use.
export function openCompanyDatabase(company: Company): Promise<PGlite> {
  const open = (global.__pgliteByCompany__ ??= new Map());
  let db = open.get(company.slug);
  if (!db) {
    db = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const dir = companyDbDir(company.slug);
      fs.mkdirSync(dir, { recursive: true });
      const instance = new PGlite(dir, PGLITE_OPTIONS);
      await instance.waitReady;
      await applyMigrationsAndSeed(instance, company);
      // The first time a company is opened on a day, keep a dated copy of it.
      await autoBackup(instance, company);
      return instance;
    })();
    open.set(company.slug, db);
    // A failed start must not be cached forever.
    db.catch(() => open.delete(company.slug));
  }
  return db;
}

/** Close a company's database and forget it (it is reopened on next use). Used when putting a backup back. */
export async function closeCompanyDatabase(slug: string): Promise<void> {
  const open = global.__pgliteByCompany__;
  const db = open?.get(slug);
  if (!db) return;
  open?.delete(slug);
  try {
    await (await db).close();
  } catch {
    // already closed
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await openCompanyDatabase(await currentCompany());
  return (await db.query<T>(text, params)).rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Multi-statement writes (an invoice header plus its lines, replacing a set of lines on edit, etc.)
// run inside one transaction so they either all happen or none do.
export async function withTransaction<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
  const db = await openCompanyDatabase(await currentCompany());
  return db.transaction(async (tx) => fn({ query: (text, params) => tx.query(text, params) as never }));
}
