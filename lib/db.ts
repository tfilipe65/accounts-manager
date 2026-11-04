// Database entry point. Postgres only (Supabase, via the transaction pooler,
// port 6543), same convention as the sibling apps -- no supabase-js, no
// Auth/Storage calls, straight `pg` connection.

import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// DATE columns (oid 1082) default to JS Date objects, which then round-trip
// through a timezone on every .toISOString()/.toLocaleDateString() call --
// anywhere behind UTC silently shows the previous day for a plain calendar
// date with no time component. Every date in this schema (invoice dates,
// opening balances, ...) is a bare YYYY-MM-DD with no meaningful time or
// timezone, so keep it as the string Postgres already sends -- no Date
// object, no conversion, no bug.
types.setTypeParser(1082, (val) => val);

declare global {
  var __pgPool__: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__pgPool__) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.local.example to .env.local and fill in the " +
          "Supabase transaction-pooler connection string (Project Settings -> Database)."
      );
    }
    global.__pgPool__ = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return global.__pgPool__;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Multi-statement writes (an invoice header plus its lines, replacing a set
// of lines on edit, etc.) need one connection held across BEGIN/COMMIT --
// query()/queryOne() each borrow a fresh connection from the pool, which
// would silently split a "transaction" across different backends.
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
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
