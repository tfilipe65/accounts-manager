// Builds, from the files extracted out of Teia_Accounts.xlsb, the first-run data of a new company database:
//   db/seed.sql              the chart of accounts and generic settings every company starts from
//   db/profiles/<slug>.sql   one company's own details (teia-firme) or practice data (test)
// Both are git-ignored (the profiles hold Teia Firme's real customers, suppliers and balances).
// Run once on the PC that has the workbook folder:  node scripts/build-seed.mjs
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

// Generic starting settings: every company begins from these. The company's name is filled in when its
// database is created; db/profiles/<company>.sql then adds that company's own details.
out.push(`INSERT INTO app_settings
  (id, company_name, currency, date_format, fiscal_year_start_month, reporting_year,
   first_invoice_number, invoice_prefix, invoice_suffix, payment_term_days, payment_term_reminder_days,
   validity_period_offer_days, vat_rate_1, vat_rate_2, vat_rate_3, age_analysis_1_days, age_analysis_2_days, age_analysis_3_days,
   account_no_ar, account_no_ap, account_no_sales, account_no_sales_tax_payable, account_no_purchase_tax_payable, account_no_vat_paid_received)
VALUES
  (1, 'New company', '€', 'dd-mmm-yyyy', 1, EXTRACT(YEAR FROM now())::int,
   1, 'INV', '-' || EXTRACT(YEAR FROM now())::int, 14, 7,
   60, 0.23, 0.13, 0.06, 30, 60, 90,
   300, 1000, 2000, 1120, 1130, 3000);`);

out.push(`INSERT INTO bank_accounts (key, name, account_no, is_cash) VALUES
('BANK1', 'Bank account 1', 100, false),
('BANK2', 'Bank account 2', 110, false),
('BANK3', 'Cash account', 122, false),
('CASH', 'Petty cash', 130, true);`);

out.push(`UPDATE accounts SET is_reserved = true WHERE account_no IN (300, 1000, 1120, 1130, 3000, 100, 110, 130, 122);`);

// ---- Company profiles: db/profiles/<company slug>.sql, applied once after the template above. ----
// Teia Firme's own details (from the workbook's Settings sheet). The IBAN is not in the workbook ("PT50" only).
const teiaDetails = `UPDATE app_settings SET
  company_name = 'Teia Firme Lda', vat_number = 'PT 507706846', bank_name = 'Millenium BCP', bic = 'BCOMPTPL',
  telephone = '351 - 289 397 225', email = 'info@teiafirme.com', website = 'www.teiafirme.com', const_guarantee_years = 5
WHERE id = 1;
UPDATE bank_accounts SET name = 'BCP - Check Acct.' WHERE key = 'BANK1';
UPDATE bank_accounts SET name = 'BCP - IVA Acct.' WHERE key = 'BANK2';
UPDATE bank_accounts SET name = 'Cash Account' WHERE key = 'BANK3';
UPDATE bank_accounts SET name = 'Petty Cash Acct.' WHERE key = 'CASH';`;

// The Test company: Teia Firme's workbook as it was in 2020, with its customers, suppliers and opening balances.
// (seed_master_data.sql is already generated, copied verbatim.) The transactions come from import-workbook.mjs.
const testProfile = [
  teiaDetails,
  `UPDATE app_settings SET reporting_year = 2020, first_invoice_number = 155, invoice_suffix = '-2020' WHERE id = 1;`,
  read("seed_master_data.sql").trim(),
].join("\n\n") + "\n";

const profiles = { "teia-firme": teiaDetails + "\n", test: testProfile };

const profileDir = path.join(path.dirname(OUT), "profiles");
mkdirSync(profileDir, { recursive: true });
for (const [slug, body] of Object.entries(profiles)) writeFileSync(path.join(profileDir, slug + ".sql"), body, "utf8");

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join("\n\n") + "\n", "utf8");
console.log("wrote", OUT, `(${out.length} blocks) and`, Object.keys(profiles).length, "profiles");
