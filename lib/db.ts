// Database entry point. Two backends behind the same three functions:
//
//   * DATABASE_URL set  -> real Postgres (Supabase / office server) through `pg`.
//   * DATABASE_URL unset -> the desktop app: an embedded Postgres (PGlite) whose files live in
//     %LOCALAPPDATA%\net.algarvebuilders.accounts-manager\db (override with ACCOUNTS_DATA_DIR).
//
// Both speak the same SQL, so going live is: point DATABASE_URL at the server and move the data.
// The schema is the files in supabase/migrations; they are applied to the local database on
// start-up (and recorded in _migrations). db/seed.sql (built by scripts/build-seed.mjs) fills a
// brand-new local database once.

import { Pool, types, type QueryResultRow } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import os from "os";
import path from "path";

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
  var __pglite__: Promise<PGlite> | undefined;
}

export function usingLocalDatabase(): boolean {
  return !process.env.DATABASE_URL;
}

/** Folder holding everything the desktop app keeps on this PC (database, secret). */
export function dataDir(): string {
  if (process.env.ACCOUNTS_DATA_DIR) return process.env.ACCOUNTS_DATA_DIR;
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), ".local", "share");
  return path.join(base, "net.algarvebuilders.accounts-manager");
}

/** Where the schema/seed files are: the project folder in dev, the bundle's resources in the installed app. */
function resourcesDir(): string {
  return process.env.ACCOUNTS_RESOURCES_DIR || process.cwd();
}

function getPool(): Pool {
  if (!global.__pgPool__) {
    global.__pgPool__ = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return global.__pgPool__;
}

async function applyMigrationsAndSeed(db: PGlite): Promise<void> {
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
      await db.exec(fs.readFileSync(seedFile, "utf8") + `\nINSERT INTO _migrations (name) VALUES ('__seed__');`);
    }
  }
}

function getLocal(): Promise<PGlite> {
  if (!global.__pglite__) {
    global.__pglite__ = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const dir = path.join(dataDir(), "db");
      fs.mkdirSync(dir, { recursive: true });
      const db = new PGlite(dir, { parsers: { 1082: (v: string) => v } });
      await db.waitReady;
      await applyMigrationsAndSeed(db);
      return db;
    })();
    // A failed start must not be cached forever.
    global.__pglite__.catch(() => {
      global.__pglite__ = undefined;
    });
  }
  return global.__pglite__;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  if (usingLocalDatabase()) {
    const db = await getLocal();
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
    const db = await getLocal();
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
