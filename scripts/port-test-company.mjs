// Moves a company that still sits on the OLD chart of accounts (the Test company with the Teia workbook data)
// onto the NEW chart, keeping every customer, supplier, project, invoice, payment and opening balance.
//
//   node scripts/port-test-company.mjs --from <old db folder> --to <new db folder> [--template C] [--profile test]
//
// The TO folder must not exist: it is built from scratch exactly as the app builds a new company (migrations,
// db/seed.sql, db/charts/<template>.sql, profile) and then filled from the old database. The old folder is only
// read. Close the app first (one process per embedded database). To use the result, close the app and replace
// companies\test\db with the new folder (keep the old one as a backup).
//
// The workbook booked loan repayments, social security paid to the State and withheld tax paid as plain costs, and
// there are no payroll or split entries to split them properly, so for this practice data they stay costs
// (2370 -> interest 6911, 2990 -> employer social security 6351, 3010 -> field wages 6321). New data should use
// the payroll entry and the split payment instead.
//
// Account numbers follow the OLD table in scripts/chart-data.mjs. Where it names two accounts the first is used,
// except where the choice is made below (CHOICES).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";
import { NEW_NO } from "./chart-data.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const FROM = opt("--from", null);
const TO = opt("--to", null);
const TEMPLATE = opt("--template", "C");
const PROFILE = opt("--profile", "test");
if (!FROM || !TO) throw new Error("Usage: node scripts/port-test-company.mjs --from <old db> --to <new db>");
if (fs.existsSync(TO)) throw new Error(`${TO} already exists. Choose a new folder.`);
fs.mkdirSync(path.dirname(path.resolve(TO)), { recursive: true });
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// old (workbook) account number -> the number in the draft chart; NEW_NO then turns that into the final number
const MAP = {
  100: 1210, 110: 1220, 122: 1230, 130: 1110,
  300: 2110, 720: 4330, 740: 4350, 760: 4340, 780: 4110, 790: 3210,
  1000: 2210, 1110: 2723, 1120: 2433, 1130: 2432, 1150: 2421, 1160: 2414, 1170: 1290, 1180: 2511,
  1200: 5110, 1210: 5310, 1230: 2631, 1400: 5610, 1410: 5590,
  2000: 7211, 2010: 7190, 2020: 7910, 2030: 7885, 2040: 7889, 2050: 2437, 2060: 7881, 2070: 7910,
  2100: 6110, 2110: 6321, 2120: 6211, 2130: 6212, 2140: 6213, 2150: 6190, 2160: 6214, 2170: 6216,
  2200: 6222, 2210: 6222, 2220: 6234, 2230: 6830, 2240: 6382, 2250: 6225, 2270: 6813, 2280: 6233, 2290: 6268,
  2300: 6268, 2310: 6233, 2320: 6322, 2330: 62682, 2340: 6268, 2350: 6266, 2360: 6371, 2370: 6911,
  2500: 6242, 2510: 6227, 2520: 6227, 2530: 6252, 2540: 6811,
  2600: 62631, 2610: 62632, 2620: 6371, 2630: 62632, 2640: 62632, 2650: 6361,
  2700: 6224, 2710: 6265, 2720: 6224, 2810: 6266, 2820: 6251, 2830: 6381,
  2900: 6241, 2910: 6262, 2930: 6243, 2940: 6231, 2950: 62682, 2960: 62682, 2970: 6351, 2990: 6351,
  3000: 2436, 3010: 6321, 3020: 8121, 3030: 6911, 3040: 62681, 3050: 6981, 3060: 6422,
};
const mapAccount = (n) => {
  if (n == null) return n;
  const m = MAP[Number(n)];
  if (m === undefined) throw new Error(`No new account for old account ${n}`);
  if (NEW_NO[m] === undefined) throw new Error(`Draft account ${m} is not in the chart`);
  return NEW_NO[m];
};

// ---------- the old database (read only) ----------
const old = new PGlite(FROM, { parsers: { 1082: (v) => v } });
await old.waitReady;
const oq = async (s, p = []) => (await old.query(s, p)).rows;

// ---------- the new database, built the way the app builds one ----------
const db = new PGlite(TO, { parsers: { 1082: (v) => v } });
await db.waitReady;
await db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
const migDir = path.join(root, "db", "migrations");
for (const f of fs.readdirSync(migDir).filter((x) => x.endsWith(".sql")).sort())
  await db.exec(fs.readFileSync(path.join(migDir, f), "utf8") + `\nINSERT INTO _migrations (name) VALUES ('${f}');`);
const profileFile = path.join(root, "db", "profiles", `${PROFILE}.sql`);
await db.exec(
  fs.readFileSync(path.join(root, "db", "seed.sql"), "utf8") + "\n" +
    fs.readFileSync(path.join(root, "db", "charts", `${TEMPLATE}.sql`), "utf8") +
    "\nUPDATE app_settings SET company_name = 'Test' WHERE id = 1;\n" +
    (fs.existsSync(profileFile) ? fs.readFileSync(profileFile, "utf8") : "") +
    "\nINSERT INTO _migrations (name) VALUES ('__seed__');"
);
const nq = async (s, p = []) => (await db.query(s, p)).rows;

// Old chart has a third bank account (Cash Account, 122); the new template has bank accounts 1 and 2 and petty cash.
const oldBanks = await oq("SELECT * FROM bank_accounts ORDER BY id");
for (const b of oldBanks) {
  if (await nq("SELECT 1 FROM bank_accounts WHERE key = $1", [b.key]).then((r) => r.length)) continue;
  const no = mapAccount(b.account_no);
  await db.query("INSERT INTO bank_accounts (key, name, account_no, is_cash) VALUES ($1,$2,$3,$4)", [b.key, b.name, no, b.is_cash]);
  await db.query("UPDATE accounts SET is_reserved = true WHERE account_no = $1", [no]);
}
const newBankId = new Map((await nq("SELECT id, key FROM bank_accounts")).map((r) => [r.key, r.id]));
const bankIdMap = new Map(oldBanks.map((b) => [b.id, newBankId.get(b.key)]));
await db.query("UPDATE bank_accounts SET name = $2 WHERE key = $1", ["BANK3", "Cash Account"]);

// ---------- copy ----------
async function copy(table, { mapCols = [], bank = false } = {}) {
  const rows = await oq(`SELECT * FROM ${table} ORDER BY 1`);
  if (!rows.length) return 0;
  const cols = (await nq("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table])).map((r) => r.column_name);
  const use = Object.keys(rows[0]).filter((c) => cols.includes(c));
  for (const r of rows) {
    const vals = use.map((c) => {
      let v = r[c];
      if (mapCols.includes(c)) v = mapAccount(v);
      if (bank && c === "bank_account_id") v = bankIdMap.get(v);
      return v;
    });
    await db.query(`INSERT INTO ${table} (${use.join(",")}) VALUES (${use.map((_, i) => "$" + (i + 1)).join(",")})`, vals);
  }
  const hasId = use.includes("id");
  if (hasId) await db.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), (SELECT COALESCE(MAX(id),1) FROM ${table}))`);
  return rows.length;
}

const counts = {};
await db.exec("BEGIN");
try {
  // The company's own logins come across too (people must not have to create them again).
  counts.users = await copy("users");
  for (const t of ["customers", "suppliers", "projects", "products_services"]) counts[t] = await copy(t, { mapCols: ["account_no"] });
  counts.sales_invoices = await copy("sales_invoices");
  counts.sales_invoice_lines = await copy("sales_invoice_lines", { mapCols: ["account_no"] });
  counts.purchase_invoices = await copy("purchase_invoices");
  counts.purchase_invoice_lines = await copy("purchase_invoice_lines", { mapCols: ["account_no"] });
  counts.bank_transactions = await copy("bank_transactions", { mapCols: ["account_no"], bank: true });
  counts.journal_entries = await copy("journal_entries", { mapCols: ["account_no"] });
  counts.opening_balances = await copy("opening_balances", { mapCols: ["account_no"] });

  // Settings that belong to the business (numbering, terms, VAT rates, details), not the account pointers.
  const s = (await oq("SELECT * FROM app_settings WHERE id = 1"))[0];
  const skip = new Set(["id", "company_name", "closed_through_year"]);
  const cols = (await nq("SELECT column_name FROM information_schema.columns WHERE table_name = 'app_settings'")).map((r) => r.column_name);
  for (const c of Object.keys(s)) {
    if (skip.has(c) || !cols.includes(c) || c.startsWith("account_no")) continue;
    await db.query(`UPDATE app_settings SET ${c} = $1 WHERE id = 1`, [s[c]]);
  }
  await db.exec("COMMIT");
} catch (e) {
  await db.exec("ROLLBACK");
  throw e;
}
console.log(counts);

// ---------- compare ----------
const sum = async (d, sql) => Number((await d.query(sql)).rows[0].v);
for (const [label, sql] of [
  ["sales gross", "SELECT COALESCE(SUM(quantity*price_ex_vat*(1-discount_perc)*(1+vat_perc)),0) v FROM sales_invoice_lines"],
  ["purchases gross", "SELECT COALESCE(SUM(amount_inc_vat),0) v FROM purchase_invoice_lines"],
  ["bank in", "SELECT COALESCE(SUM(in_amount+in_vat),0) v FROM bank_transactions"],
  ["bank out", "SELECT COALESCE(SUM(out_amount+out_vat),0) v FROM bank_transactions"],
  ["opening debit", "SELECT COALESCE(SUM(debit),0) v FROM opening_balances"],
]) console.log(label.padEnd(16), (await sum(old, sql)).toFixed(2), (await sum(db, sql)).toFixed(2));
await old.close();
await db.close();
console.log("Done:", TO);
