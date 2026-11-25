// Builds the company profiles: db/profiles/<slug>.sql, applied once to a company's database after the chart
// (the chart itself comes from scripts/build-chart.mjs). A profile holds one company's own details. The
// folder is git-ignored because Teia Firme's details are real.
//   node scripts/build-seed.mjs
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Teia Firme's own details (from the workbook's Settings sheet). The IBAN is not in the workbook ("PT50" only).
const teiaDetails = `UPDATE app_settings SET
  company_name = 'Teia Firme Lda', vat_number = 'PT 507706846', bank_name = 'Millenium BCP', bic = 'BCOMPTPL',
  telephone = '351 - 289 397 225', email = 'info@teiafirme.com', website = 'www.teiafirme.com', const_guarantee_years = 5
WHERE id = 1;
UPDATE bank_accounts SET name = 'BCP - Check Acct.' WHERE key = 'BANK1';
UPDATE bank_accounts SET name = 'BCP - IVA Acct.' WHERE key = 'BANK2';
UPDATE bank_accounts SET name = 'Petty Cash Acct.' WHERE key = 'CASH';`;

// Property management: what other businesses call projects, Casas Algarve calls properties.
const propertyLabels = `UPDATE app_settings SET project_label = 'Properties' WHERE id = 1;\n`;

const profiles = {
  "teia-firme": teiaDetails + "\n",
  test: teiaDetails + "\n",
  "casas-algarve": propertyLabels,
  "casas-algarve-clients": propertyLabels,
};

const profileDir = path.join(root, "db", "profiles");
mkdirSync(profileDir, { recursive: true });
for (const [slug, body] of Object.entries(profiles)) writeFileSync(path.join(profileDir, slug + ".sql"), body, "utf8");
console.log("wrote", Object.keys(profiles).length, "profiles");
