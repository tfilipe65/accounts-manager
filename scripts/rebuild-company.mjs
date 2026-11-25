// Rebuilds a company's database on the CURRENT chart of accounts (its template in db/charts), keeping only
//   * the company's own logins (users table), and
//   * the business settings (numbering, terms, VAT rates, details) -- not the account pointers.
// Everything else (customers, invoices, bank lines, journal entries ...) is NOT carried over: use this for
// companies that hold only sample data, then load the sample data again. For a company with real data on the old
// chart use scripts/port-test-company.mjs, which maps old account numbers to new ones.
//
//   node scripts/rebuild-company.mjs --slug teia-firme --template C --name "Teia Firme" \
//        --data <data folder> --backup <folder for the replaced database>
//
// Close the app first (one process per embedded database). The old database folder is moved to --backup, not deleted.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const SLUG = opt("--slug"), TEMPLATE = opt("--template"), NAME = opt("--name"), DATA = opt("--data"), BACKUP = opt("--backup");
if (!SLUG || !TEMPLATE || !NAME || !DATA || !BACKUP) throw new Error("Usage: see the top of this file");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbDir = path.join(DATA, "companies", SLUG, "db");
const newDir = path.join(DATA, "companies", SLUG, "db.new");
const saved = path.join(BACKUP, `${SLUG}-db`);
if (!fs.existsSync(dbDir)) throw new Error(`${dbDir} not found`);
if (fs.existsSync(newDir) || fs.existsSync(saved)) throw new Error("db.new or the backup folder already exists");

const old = new PGlite(dbDir, { parsers: { 1082: (v) => v } });
await old.waitReady;
const oq = async (s) => (await old.query(s)).rows;

const db = new PGlite(newDir, { parsers: { 1082: (v) => v } });
await db.waitReady;
await db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
const migDir = path.join(root, "db", "migrations");
for (const f of fs.readdirSync(migDir).filter((x) => x.endsWith(".sql")).sort())
  await db.exec(fs.readFileSync(path.join(migDir, f), "utf8") + `\nINSERT INTO _migrations (name) VALUES ('${f}');`);
const profileFile = path.join(root, "db", "profiles", `${SLUG}.sql`);
await db.exec(
  fs.readFileSync(path.join(root, "db", "seed.sql"), "utf8") + "\n" +
    fs.readFileSync(path.join(root, "db", "charts", `${TEMPLATE}.sql`), "utf8") +
    `\nUPDATE app_settings SET company_name = '${NAME.replace(/'/g, "''")}' WHERE id = 1;\n` +
    (fs.existsSync(profileFile) ? fs.readFileSync(profileFile, "utf8") : "") +
    "\nINSERT INTO _migrations (name) VALUES ('__seed__');"
);
const nq = async (s, p = []) => (await db.query(s, p)).rows;

// logins
const users = await oq("SELECT * FROM users ORDER BY 1");
if (users.length) {
  const cols = (await nq("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")).map((r) => r.column_name);
  const use = Object.keys(users[0]).filter((c) => cols.includes(c));
  for (const r of users)
    await db.query(`INSERT INTO users (${use.join(",")}) VALUES (${use.map((_, i) => "$" + (i + 1)).join(",")})`, use.map((c) => r[c]));
  await db.query("SELECT setval(pg_get_serial_sequence('users','id'), (SELECT COALESCE(MAX(id),1) FROM users))");
}

// business settings
const s = (await oq("SELECT * FROM app_settings WHERE id = 1"))[0];
const skip = new Set(["id", "company_name", "closed_through_year"]);
const scols = (await nq("SELECT column_name FROM information_schema.columns WHERE table_name = 'app_settings'")).map((r) => r.column_name);
for (const c of Object.keys(s)) {
  if (skip.has(c) || !scols.includes(c) || c.startsWith("account_no")) continue;
  await db.query(`UPDATE app_settings SET ${c} = $1 WHERE id = 1`, [s[c]]);
}

const acc = (await nq("SELECT count(*)::int n FROM accounts"))[0].n;
const sub = (await nq("SELECT count(*)::int n FROM account_subgroups"))[0].n;
const u = (await nq("SELECT username, role FROM users")).map((x) => `${x.username}:${x.role}`);
await old.close();
await db.close();

// swap: old database aside (not deleted), new one in place
fs.mkdirSync(BACKUP, { recursive: true });
fs.renameSync(dbDir, saved);
fs.renameSync(newDir, dbDir);
console.log(`${SLUG}: template ${TEMPLATE}, ${acc} accounts, ${sub} subgroups, users [${u.join(", ")}] (${users.length} carried over); old database moved to ${saved}`);
