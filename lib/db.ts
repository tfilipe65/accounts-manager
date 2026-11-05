// Database entry point. Two backends behind the same three functions:
//
//   * DATABASE_URL set  -> real Postgres (Supabase / office server) through `pg`: one company.
//   * DATABASE_URL unset -> the desktop app: one embedded Postgres (PGlite) per company, under
//     %LOCALAPPDATA%\net.algarvebuilders.accounts-manager\companies\<company>\db (override the base
//     folder with ACCOUNTS_DATA_DIR). The company is the one in the `company` cookie (lib/companies.ts).
//
// Both speak the same SQL, so going live is: point DATABASE_URL at the server and move the data.
// The schema is the files in supabase/migrations; they are applied to a company's database when it
// is first opened (and recorded in _migrations). A brand-new company database is filled once from
// db/seed.sql (the chart of accounts and defaults) plus db/profiles/<company>.sql when that exists;
// both are built by scripts/build-seed.mjs.

import { Pool, types, type QueryResultRow } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { resourcesDir } from "./data-dir";
import { getCurrentCompany } from "./current-company";
import { companyDbDir, type Company } from "./companies";

// DATE columns (oid 1082) default to JS Date objects, which then round-trip
// through a timezone on every .toISOString()/.toLocaleDateString() call --
// anywhere behind UTC silently shows the previous day for a plain calendar
// date with no time component. Every date in this schema (invoice dates,
// opening balances, ...) is a bare YYYY-MM-DD with no meaningful time or
// timezone, so keep it as the string Postgres already sends -- no Date
// object, no conversion, no bug.
types.setTypeParser(1082, (val) => val);

/** What a transaction body gets: just `query`, identical on both backends. */
export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

declare global {
  var __pgPool__: Pool | undefined;
  var __pgliteByCompany__: Map<string, Promise<PGlite>> | undefined;
}

export function usingLocalDatabase(): boolean {
  return !process.env.DATABASE_URL;
}

function getPool(): Pool {
  if (!global.__pgPool__) {
    global.__pgPool__ = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return global.__pgPool__;
}

async function applyMigrationsAndSeed(db: PGlite, company: Company): Promise<void> {
  await db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const applied = new Set((await db.query<{ name: string }>("SELECT name FROM _migrations")).rows.map((r) => r.name));

  const migDir = path.join(resourcesDir(), "supabase", "migrations");
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
function getLocal(company: Company): Promise<PGlite> {
  const open = (global.__pgliteByCompany__ ??= new Map());
  let db = open.get(company.slug);
  if (!db) {
    db = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const dir = companyDbDir(company.slug);
      fs.mkdirSync(dir, { recursive: true });
      const instance = new PGlite(dir, { parsers: { 1082: (v: string) => v } });
      await instance.waitReady;
      await applyMigrationsAndSeed(instance, company);
      return instance;
    })();
    open.set(company.slug, db);
    // A failed start must not be cached forever.
    db.catch(() => open.delete(company.slug));
  }
  return db;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  if (usingLocalDatabase()) {
    const db = await getLocal(await currentCompany());
    return (await db.query<T>(text, params)).rows;
  }
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Multi-statement writes (an invoice header plus its lines, replacing a set
// of lines on edit, etc.) need one connection held across BEGIN/COMMIT --
// query()/queryOne() each borrow a fresh connection from the pool, which
// would silently split a "transaction" across different backends.
export async function withTransaction<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
  if (usingLocalDatabase()) {
    const db = await getLocal(await currentCompany());
    return db.transaction(async (tx) => fn({ query: (text, params) => tx.query(text, params) as never }));
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
