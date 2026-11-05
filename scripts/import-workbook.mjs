// One-time import of the transaction registers of Teia_Accounts.xlsb into the local (PGlite) database.
//
//   powershell -File scripts\export-workbook.ps1        (exports the sheets to db\workbook-export)
//   node scripts\import-workbook.mjs                    (dry run: parse, check, report, write nothing)
//   node scripts\import-workbook.mjs --apply            (write; refuses if transactions already exist)
//   node scripts\import-workbook.mjs --apply --replace  (wipe the transaction tables first)
//
// Close the app first -- the embedded database allows one process at a time.
// Options: --data-dir <folder> (default: the app's own data folder), --export-dir <folder>.
//
// Mapping (checked against the workbook's own columns):
//   Income sheet          -> sales_invoices + sales_invoice_lines   (grouped by the sales ID in column D)
//   Expense sheet         -> purchase_invoices + lines              (grouped by the expense ID = number before "-" in the line key)
//   Bank_1 / Bank_2 / Bank_3 / Cash -> bank_transactions on BANK1 / BANK2 / BANK3 (Cash Account) / CASH (Petty Cash)
//   A payment row with a Sales ID / Expense ID is linked to that invoice; any other row is a direct entry on its account.
//   Journal_Entry         -> journal_entries
// Opening balances and master data come from db/seed.sql, not from here.

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const APPLY = flag("--apply");
const REPLACE = flag("--replace");
const here = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = opt("--export-dir", path.join(here, "..", "db", "workbook-export"));
const DATA_DIR =
  opt("--data-dir", null) ||
  process.env.ACCOUNTS_DATA_DIR ||
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".local", "share"), "net.algarvebuilders.accounts-manager");

// ---------- reading the exported sheets ----------
function sheet(name) {
  const rows = fs.readFileSync(path.join(EXPORT_DIR, name + ".tsv"), "utf8").split(/\r?\n/).map((l) => l.split("\t"));
  const h = rows.findIndex((r) => r.some((c) => /^(Description|Invoice #)$/.test(c)));
  if (h < 0) throw new Error(`${name}: header row not found`);
  return rows.slice(h + 1);
}
const isNum = (v) => v !== undefined && v !== "" && !Number.isNaN(Number(v));
const n = (v, d = 0) => (isNum(v) ? Number(v) : d);
const txt = (v) => (v === undefined || v === "" ? null : v);
const iso = (serial) => new Date(Math.round((Number(serial) - 25569) * 86400000)).toISOString().slice(0, 10);
const cents = (x) => Math.round(x * 100);
const eur = (c) => (c / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const problems = [];
const warn = (m) => problems.push(m);

// ---------- database ----------
const db = new PGlite(path.join(DATA_DIR, "db"), { parsers: { 1082: (v) => v } });
await db.waitReady;
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const lookup = async (sql, key) => new Map((await q(sql)).map((r) => [key(r), r.id]));
const customers = await lookup("SELECT id, name FROM customers", (r) => r.name.trim().toLowerCase());
const suppliers = await lookup("SELECT id, name FROM suppliers", (r) => r.name.trim().toLowerCase());
const projects = await lookup("SELECT id, code FROM projects", (r) => r.code.trim().toLowerCase());
const products = await lookup("SELECT id, name FROM products_services", (r) => r.name.trim().toLowerCase());
const accounts = new Set((await q("SELECT account_no FROM accounts")).map((r) => String(r.account_no)));
const banks = await lookup("SELECT id, key FROM bank_accounts", (r) => r.key);
if (!customers.size || !accounts.size) throw new Error("The database has no master data yet: start the app once so it seeds itself, then close it and run this again.");

const existing = Number((await q("SELECT (SELECT COUNT(*) FROM sales_invoices) + (SELECT COUNT(*) FROM purchase_invoices) + (SELECT COUNT(*) FROM bank_transactions) + (SELECT COUNT(*) FROM journal_entries) AS c"))[0].c);
if (APPLY && existing > 0 && !REPLACE) throw new Error(`There are already ${existing} transaction rows. Use --replace to wipe them first.`);

const need = (map, key, what, ctx) => {
  const id = map.get(String(key).trim().toLowerCase());
  if (id === undefined) warn(`${ctx}: unknown ${what} "${key}"`);
  return id;
};

// ---------- sales ----------
const DOC_TYPE = { 1: "Invoice", 2: "Credit Note", 3: "Proforma", 4: "Tax Refund", 5: "Interest", 6: "Other" };
const salesRows = sheet("Income").filter((r) => isNum(r[6]) && r[4] !== "");
const sales = new Map(); // sales ID -> invoice
for (const r of salesRows) {
  const key = r[3];
  if (!sales.has(key)) {
    sales.set(key, {
      key,
      invoice_number: r[4],
      date: iso(r[6]),
      doc_type: DOC_TYPE[n(r[7], 1)] ?? "Invoice",
      customer_id: need(customers, r[11], "customer", `sales ${r[4]}`),
      reference: txt(r[23]),
      sales_id: txt(r[24]),
      lines: [],
      sheetGross: 0,
    });
  }
  const inv = sales.get(key);
  const account = String(r[20]);
  if (!accounts.has(account)) warn(`sales ${r[4]}: unknown account ${account}`);
  inv.lines.push({
    line_no: n(r[5], inv.lines.length + 1),
    product_service_id: r[13] ? need(products, r[13], "product/service", `sales ${r[4]}`) : null,
    subject: txt(r[19]),
    quantity: n(r[16], 1),
    price_ex_vat: n(r[17]),
    vat_perc: n(r[18]),
    discount_perc: n(r[26]),
    account_no: Number(account),
    project_id: r[22] ? need(projects, r[22], "project", `sales ${r[4]}`) : null,
    free_code: txt(r[25]),
  });
  inv.sheetGross += n(r[32]);
}
const salesNumbers = new Set();
for (const inv of sales.values()) {
  if (salesNumbers.has(inv.invoice_number)) warn(`sales invoice number ${inv.invoice_number} appears twice`);
  salesNumbers.add(inv.invoice_number);
}

// ---------- purchases ----------
const purchRows = sheet("Expense").filter((r) => isNum(r[6]) && r[4] !== "");
const purchases = new Map(); // expense ID -> invoice
for (const r of purchRows) {
  const key = String(r[1]).split("-")[0]; // line key "20727-1" -> expense ID 20727
  if (!purchases.has(key)) {
    purchases.set(key, {
      key,
      numbers: [r[4]],
      date: iso(r[6]),
      supplier_id: need(suppliers, r[10], "supplier", `expense ${r[4]}`),
      lines: [],
      sheetGross: 0,
    });
  }
  const inv = purchases.get(key);
  // One expense ID can cover two supplier invoices paid together (e.g. FA6865 + FA6864): keep it as one invoice.
  if (!inv.numbers.includes(r[4])) inv.numbers.push(r[4]);
  if (inv.date !== iso(r[6])) warn(`expense ${key}: lines disagree on date (${inv.date} vs ${iso(r[6])})`);
  const account = String(r[12]);
  if (!accounts.has(account)) warn(`expense ${r[4]}: unknown account ${account}`);
  inv.lines.push({
    line_no: n(r[5], inv.lines.length + 1),
    description: txt(r[11]),
    account_no: Number(account),
    project_id: r[14] ? need(projects, r[14], "project", `expense ${r[4]}`) : null,
    vat_perc: n(r[18]),
    amount_inc_vat: n(r[19]),
    remarks: txt(r[15]),
    free_code_1: txt(r[16]),
    free_code_2: txt(r[17]),
  });
  inv.sheetGross += n(r[19]);
}
// The database needs unique invoice numbers; the workbook keys on the expense ID, and 101 numbers repeat across suppliers.
const used = new Set();
const renamed = [];
for (const inv of [...purchases.values()].sort((a, b) => Number(a.key) - Number(b.key))) {
  const base = inv.numbers.join(" + ");
  let no = base;
  for (let i = 2; used.has(no); i++) no = `${base}-${i}`;
  if (no !== base) renamed.push(`${base} -> ${no} (expense ${inv.key})`);
  used.add(no);
  inv.invoice_number = no;
}

// ---------- bank / cash ----------
const bankTx = [];
function bankRow(bankKey, sheetName, r, c) {
  // c = column positions for this sheet layout
  const salesKey = c.sales !== undefined ? r[c.sales] : "";
  const expKey = r[c.exp];
  const inAmt = n(r[c.in]), outAmt = n(r[c.out]), inVat = n(r[c.inVat]), outVat = n(r[c.outVat]);
  const ctx = `${sheetName} ${r[1]}`;
  const tx = {
    bank: bankKey,
    ref: ctx,
    payment_date: iso(r[c.date]),
    description: txt(r[c.desc]),
    sales_key: null,
    purchase_key: null,
    account_no: null,
    vat_perc: isNum(r[c.vat]) && r[c.vat] !== "" ? Number(r[c.vat]) : null,
    in_amount: inAmt,
    in_vat: inVat,
    out_amount: outAmt,
    out_vat: outVat,
  };
  if (salesKey) {
    if (!sales.has(salesKey)) warn(`${ctx}: sales ID ${salesKey} not found`);
    else if (c.salesNo !== undefined && r[c.salesNo] && sales.get(salesKey).invoice_number !== r[c.salesNo]) warn(`${ctx}: sales ID ${salesKey} is ${sales.get(salesKey).invoice_number} but the row says ${r[c.salesNo]}`);
    tx.sales_key = salesKey;
  } else if (expKey) {
    if (!purchases.has(expKey)) warn(`${ctx}: expense ID ${expKey} not found`);
    else if (r[c.purchNo] && !purchases.get(expKey).numbers.includes(r[c.purchNo])) warn(`${ctx}: expense ID ${expKey} is ${purchases.get(expKey).numbers.join(" + ")} but the row says ${r[c.purchNo]}`);
    tx.purchase_key = expKey;
  } else {
    const a = String(r[c.acct]);
    if (!accounts.has(a)) warn(`${ctx}: unknown account ${a}`);
    tx.account_no = Number(a);
  }
  if (inVat || outVat) warn(`${ctx}: has a VAT amount (in ${inVat}, out ${outVat}); check it`);
  if (!inAmt && !outAmt) warn(`${ctx}: no amount`);
  bankTx.push(tx);
}
const BANK_COLS = { date: 6, acct: 7, desc: 8, vat: 9, in: 10, inVat: 11, out: 12, outVat: 14, sales: 2, exp: 3, salesNo: 4, purchNo: 5 };
const CASH_COLS = { date: 5, acct: 6, desc: 16, vat: 14, in: 17, inVat: 18, out: 19, outVat: 20, exp: 3, purchNo: 4 };
for (const [file, key] of [["Bank_1", "BANK1"], ["Bank_2", "BANK2"], ["Bank_3", "BANK3"]])
  for (const r of sheet(file).filter((r) => isNum(r[6]) && r[1] !== "")) bankRow(key, file, r, BANK_COLS);
for (const r of sheet("Cash").filter((r) => isNum(r[5]) && r[1] !== "")) bankRow("CASH", "Cash", r, CASH_COLS);

// ---------- journal ----------
const journal = sheet("Journal_Entry")
  .filter((r) => isNum(r[2]) && r[1] !== "")
  .map((r) => {
    if (!accounts.has(String(r[3]))) warn(`journal ${r[1]}: unknown account ${r[3]}`);
    return { date: iso(r[2]), account_no: Number(r[3]), description: txt(r[6]), vat_perc: isNum(r[5]) && r[5] !== "" ? Number(r[5]) : null, debit: n(r[7]), credit: n(r[8]) };
  });

// ---------- report ----------
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const salesGross = sum([...sales.values()].flatMap((i) => i.lines), (l) => l.quantity * l.price_ex_vat * (1 - l.discount_perc) * (1 + l.vat_perc));
const salesSheet = sum([...sales.values()], (i) => i.sheetGross);
const purchGross = sum([...purchases.values()].flatMap((i) => i.lines), (l) => l.amount_inc_vat);
const purchSheet = sum([...purchases.values()], (i) => i.sheetGross);
console.log(`Sales invoices   ${sales.size} (${salesRows.length} lines)  gross ${eur(cents(salesGross))}  sheet says ${eur(cents(salesSheet))}`);
console.log(`Purchase invoices ${purchases.size} (${purchRows.length} lines)  gross ${eur(cents(purchGross))}  sheet says ${eur(cents(purchSheet))}  (${renamed.length} numbers made unique)`);
for (const k of ["BANK1", "BANK2", "BANK3", "CASH"]) {
  const t = bankTx.filter((x) => x.bank === k);
  console.log(`${k.padEnd(5)} ${String(t.length).padStart(5)} rows  in ${eur(cents(sum(t, (x) => x.in_amount)))}  out ${eur(cents(sum(t, (x) => x.out_amount)))}  linked: ${t.filter((x) => x.sales_key).length} sales / ${t.filter((x) => x.purchase_key).length} purchase / ${t.filter((x) => x.account_no).length} direct`);
}
console.log(`Journal entries  ${journal.length}`);
if (Math.abs(cents(salesGross) - cents(salesSheet)) > 5) warn(`sales gross differs from the sheet by ${eur(cents(salesGross) - cents(salesSheet))}`);
if (Math.abs(cents(purchGross) - cents(purchSheet)) > 5) warn(`purchase gross differs from the sheet by ${eur(cents(purchGross) - cents(purchSheet))}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.log("  - " + p);
  if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
}
if (renamed.length) fs.writeFileSync(path.join(EXPORT_DIR, "renamed-purchase-numbers.txt"), renamed.join("\n") + "\n");

if (!APPLY) {
  console.log("\nDry run: nothing written. Add --apply to import.");
  await db.close();
  process.exit(problems.length ? 1 : 0);
}
if (problems.length) {
  console.log("\nNot importing while there are problems.");
  await db.close();
  process.exit(1);
}

// ---------- write ----------
await db.transaction(async (tx) => {
  if (REPLACE) for (const t of ["bank_transactions", "sales_invoice_lines", "sales_invoices", "purchase_invoice_lines", "purchase_invoices", "journal_entries"]) await tx.query(`DELETE FROM ${t}`);
  const salesIds = new Map(), purchIds = new Map();
  for (const inv of sales.values()) {
    const id = (await tx.query("INSERT INTO sales_invoices (invoice_number, date, doc_type, customer_id, reference, sales_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [inv.invoice_number, inv.date, inv.doc_type, inv.customer_id, inv.reference, inv.sales_id])).rows[0].id;
    salesIds.set(inv.key, id);
    for (const l of inv.lines)
      await tx.query("INSERT INTO sales_invoice_lines (sales_invoice_id, line_no, product_service_id, subject, quantity, price_ex_vat, vat_perc, discount_perc, account_no, project_id, free_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [id, l.line_no, l.product_service_id, l.subject, l.quantity, l.price_ex_vat, l.vat_perc, l.discount_perc, l.account_no, l.project_id, l.free_code]);
  }
  for (const inv of purchases.values()) {
    const id = (await tx.query("INSERT INTO purchase_invoices (invoice_number, date, supplier_id) VALUES ($1,$2,$3) RETURNING id", [inv.invoice_number, inv.date, inv.supplier_id])).rows[0].id;
    purchIds.set(inv.key, id);
    for (const l of inv.lines)
      await tx.query("INSERT INTO purchase_invoice_lines (purchase_invoice_id, line_no, description, account_no, project_id, vat_perc, amount_inc_vat, remarks, free_code_1, free_code_2) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [id, l.line_no, l.description, l.account_no, l.project_id, l.vat_perc, l.amount_inc_vat, l.remarks, l.free_code_1, l.free_code_2]);
  }
  for (const t of bankTx)
    await tx.query("INSERT INTO bank_transactions (bank_account_id, payment_date, description, sales_invoice_id, purchase_invoice_id, account_no, vat_perc, in_amount, in_vat, out_amount, out_vat) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [banks.get(t.bank), t.payment_date, t.description, t.sales_key ? salesIds.get(t.sales_key) : null, t.purchase_key ? purchIds.get(t.purchase_key) : null, t.account_no, t.vat_perc, t.in_amount, t.in_vat, t.out_amount, t.out_vat]);
  for (const j of journal)
    await tx.query("INSERT INTO journal_entries (date, account_no, description, vat_perc, debit, credit) VALUES ($1,$2,$3,$4,$5,$6)", [j.date, j.account_no, j.description, j.vat_perc, j.debit, j.credit]);
});
console.log("\nImported.");
await db.close();
