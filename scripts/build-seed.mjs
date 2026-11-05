// Builds db/seed.sql (git-ignored: it holds Teia Firme's real customers, suppliers and
// balances) from the files extracted out of Teia_Accounts.xlsb. Run once on the PC that
// has the workbook folder:  node scripts/build-seed.mjs
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SEED_DIR =
  process.env.SEED_DIR ||
  "C:\\Users\\tony\\OneDrive - Teia Firme Lda\\_ALGARVE BUILDERS\\CLAUDE AI\\AB ACCT\\analysis\\seed";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "seed.sql");

const sql = (v) => (v === undefined || v === null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? "NULL" : String(Number(v)));
const read = (f) => readFileSync(path.join(SEED_DIR, f), "utf8").replace(/^\uFEFF/, "");
const rows = (f) =>
  read(f)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.split("\t"));

const out = [];

// account_groups.tsv: group_no, name, statement ("Profit & Loss" | "Balance Sheet")
out.push(
  `INSERT INTO account_groups (group_no, name, statement) VALUES\n` +
    rows("account_groups.tsv")
      .map((f) => `(${num(f[0])}, ${sql(f[1])}, ${sql(f[2].trim() === "Profit & Loss" ? "P&L" : "Balance Sheet")})`)
      .join(",\n") +
    ";"
);

// account_subgroups.tsv: subgroup_no, name, group_no, ..., col 8 = "+" (debit-normal) / "-" (credit-normal)
out.push(
  `INSERT INTO account_subgroups (subgroup_no, name, group_no, normal_balance) VALUES\n` +
    rows("account_subgroups.tsv")
      .map((f) => `(${num(f[0])}, ${sql(f[1])}, ${num(f[2])}, ${sql((f[8] || "").trim() === "+" ? "debit" : "credit")})`)
      .join(",\n") +
    ";"
);

// accounts.tsv: account_no, name, subgroup_no
out.push(
  `INSERT INTO accounts (account_no, name, subgroup_no) VALUES\n` +
    rows("accounts.tsv")
      .map((f) => `(${num(f[0])}, ${sql(f[1])}, ${num(f[2])})`)
      .join(",\n") +
    ";"
);

// Company settings: values from the workbook's Settings sheet. Reporting year 2020 = the year the workbook covers.
out.push(`INSERT INTO app_settings
  (id, company_name, vat_number, bank_name, iban, bic, telephone, email, website, currency, date_format,
   fiscal_year_start_month, reporting_year, first_invoice_number, invoice_prefix, invoice_suffix,
   payment_term_days, payment_term_reminder_days, validity_period_offer_days, const_guarantee_years,
   vat_rate_1, vat_rate_2, vat_rate_3, age_analysis_1_days, age_analysis_2_days, age_analysis_3_days,
   account_no_ar, account_no_ap, account_no_sales, account_no_sales_tax_payable, account_no_purchase_tax_payable, account_no_vat_paid_received)
VALUES
  (1, 'Teia Firme Lda', 'PT 507706846', 'Millenium BCP', NULL, 'BCOMPTPL', '351 - 289 397 225', 'info@teiafirme.com', 'www.teiafirme.com', '€', 'dd-mmm-yyyy',
   1, 2020, 155, 'INV', '-2020',
   14, 7, 60, 5,
   0.23, 0.13, 0.06, 30, 60, 90,
   300, 1000, 2000, 1120, 1130, 3000);`);

out.push(`INSERT INTO bank_accounts (key, name, account_no, is_cash) VALUES
('BANK1', 'BCP - Check Acct.', 100, false),
('BANK2', 'BCP - IVA Acct.', 110, false),
('BANK3', 'Cash Account', 122, false),
('CASH', 'Petty Cash Acct.', 130, true);`);

out.push(`UPDATE accounts SET is_reserved = true WHERE account_no IN (300, 1000, 1120, 1130, 3000, 100, 110, 130, 122);`);

// seed_master_data.sql: customers, suppliers, products_services, projects, opening_balances — already generated, copied verbatim.
out.push(read("seed_master_data.sql").trim());

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join("\n\n") + "\n", "utf8");
console.log("wrote", OUT, `(${out.length} blocks)`);
