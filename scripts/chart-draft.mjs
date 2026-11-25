// DRAFT chart of accounts for review. One source of truth: running this writes
//   docs/chart-of-accounts-DRAFT.md    the document to read and comment on
//   docs/chart-of-accounts-DRAFT.csv   the same chart for Excel (semicolon separated)
//   docs/chart-old-to-new-DRAFT.csv    where every account of the current chart goes
// Nothing here changes the app. If the draft is approved, the same data becomes the seed.
//   node scripts/chart-draft.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.join(here, "..", "docs");

import { TEMPLATES, SECTIONS, SUBGROUPS, A, OLD } from "./chart-data.mjs";

// ------------------------------------------------------------------ checks
const sgKeys = new Set(SUBGROUPS.map((s) => s.key));
const seen = new Set();
for (const a of A) {
  if (seen.has(a[0])) throw new Error(`duplicate account number ${a[0]}`);
  seen.add(a[0]);
  if (!sgKeys.has(a[3])) throw new Error(`unknown subgroup ${a[3]} on ${a[0]}`);
  if (![...a[6]].every((c) => TEMPLATES[c])) throw new Error(`bad template letters on ${a[0]}`);
}
const roles = new Map();
for (const a of A) if (a[7]) roles.set(a[7], [...(roles.get(a[7]) ?? []), a[0]]);
for (const o of OLD) {
  for (const n of String(o[2]).match(/\d{4,5}/g) ?? []) if (!seen.has(Number(n))) throw new Error(`old ${o[0]} maps to unknown ${n}`);
}
if (new Set(OLD.map((o) => o[0])).size !== OLD.length) throw new Error("duplicate old account");
// default_sales is single per template, others are single overall
for (const [role, nos] of roles) {
  if (role === "default_sales") continue;
  if (nos.length > 1) throw new Error(`role ${role} used by ${nos.join(", ")}`);
}

// ------------------------------------------------------------------ output
const sgByKey = Object.fromEntries(SUBGROUPS.map((s) => [s.key, s]));
const secByKey = Object.fromEntries(SECTIONS.map((s) => [s.key, s]));
const count = (letter) => A.filter((a) => a[6].includes(letter)).length;
const csvCell = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";

fs.mkdirSync(docs, { recursive: true });

fs.writeFileSync(
  path.join(docs, "chart-of-accounts-DRAFT.csv"),
  csv([
    ["Number", "Name", "Nome (PT)", "Statement", "Section", "Subgroup", "Normal balance", "SNC code", "SNC match", ...Object.values(TEMPLATES), "App role", "Note"],
    ...A.map((a) => {
      const sg = sgByKey[a[3]];
      const sec = secByKey[sg.section];
      return [a[0], a[1], a[2], sec.statement, sec.name, sg.name, a[9] ? `${sg.normal} (contra)` : sg.normal, a[4], a[5], ...Object.keys(TEMPLATES).map((t) => (a[6].includes(t) ? "X" : "")), a[7] ?? "", a[8] ?? ""];
    }),
  ])
);
fs.writeFileSync(path.join(docs, "chart-old-to-new-DRAFT.csv"), csv([["Old number", "Old name", "New number", "Why"], ...OLD]));

const table = (rows) => rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
const sectionsMd = SECTIONS.map((sec) => {
  const sgs = SUBGROUPS.filter((s) => s.section === sec.key);
  return `### ${sec.name} (${sec.statement})\n\n` + sgs.map((sg) => {
    const rows = A.filter((a) => a[3] === sg.key).sort((x, y) => x[0] - y[0]);
    return `**${sg.name}** (${sg.normal}; role \`${sg.role}\`)\n\n| No. | Name | SNC | C | W | I | P | K | Note |\n|---|---|---|:-:|:-:|:-:|:-:|:-:|---|\n` + table(rows.map((a) => [a[0], a[1] + (a[9] ? " *(contra)*" : ""), a[4] + (a[5] === "confirm" ? " ⚑" : a[5] === "sub" ? " ›" : ""), ...Object.keys(TEMPLATES).map((t) => (a[6].includes(t) ? "●" : "")), a[8] ?? ""])) + "\n";
  }).join("\n");
}).join("\n");

const md = `# Chart of accounts: DRAFT for review

*Status: built into the app (new companies start from it; roles, split transactions and payroll entry use it). The accountant questions at the end are still open. Change the chart in scripts/chart-data.mjs.*

## Why a new chart

The current chart (90 accounts, from the Teia workbook) has wrong classifications (withheld tax and the employee's social security as costs, loan repayments as expenses), no logic to its numbering, one construction-only set of cost accounts for every business, and no link to the Portuguese official chart. The review that led to this draft is in the conversation. Your own data shows which accounts matter: 57 of the 90 were used in the workbook, mostly materials, fuel, subcontractors, wages and transfers.

## Design in six rules

1. **One structure, five templates.** Every company gets the same spine; a template adds or leaves out the accounts that business needs. The matrix below shows which. C = Construction (Teia Firme), W = Carpentry (Woodgrain), I = Decorations (Algarve Interior), P = Property management (Casas Algarve), K = Client money account.
2. **The account number is the SNC number.** SNC (Sistema de Normalização Contabilística) is the Portuguese official chart: 1 cash and bank, 2 receivables, payables, State and financing, 3 stock, 4 fixed assets, 5 equity, 6 costs, 7 income, 8 results. Using its numbers means your accountant, and the tax authority's SAF-T file, need no translation. Where SNC has only three digits and we need more detail, we add a digit (a *sub-account*, marked ›). Anything I am not sure of is flagged ⚑ for your accountant.
3. **Three levels stay:** section (a line of the statements) › subgroup › account. Subgroups carry a **role**, and so do a handful of single accounts (below), so the app stops depending on numbers. Renumbering later would then be harmless.
4. **Costs by nature, direct costs separated.** Cost of sales holds materials, subcontractors, direct labour and, for property management, the cleaning, laundry and repairs bought for managed properties. Everything else is an operating expense. The P&L shows gross profit and an operating result as it does now.
5. **Liabilities that are not costs stay out of the P&L.** Withheld tax (2421), social security owed (2451), VAT (2433, 2436), loan principal (2511, 2514) and client money (2788) are balance-sheet accounts.
6. **No manual "current year result" account.** The app calculates it.

## What this draft contains

- ${A.length} accounts in total: ${Object.entries(TEMPLATES).map(([k, v]) => `${v} ${count(k)}`).join(", ")}.
- ${SUBGROUPS.length} subgroups in ${SECTIONS.length} sections.
- Every one of the 90 current accounts is mapped to a new one (or dropped with a reason): \`chart-old-to-new-DRAFT.csv\`.
- The same chart for Excel, with a column per template: \`chart-of-accounts-DRAFT.csv\`.

## The chart

Legend: ● in the template; › our own sub-account of the SNC account; ⚑ to be confirmed with your accountant.

${sectionsMd}

## Accounts the app will use by role

| Role | Account | What the app does with it |
|---|---|---|
${[...roles].map(([role, nos]) => `| \`${role}\` | ${nos.join(", ")} | ${{
  accounts_receivable: "Debited by invoices, credited by payments received",
  accounts_payable: "Credited by purchase invoices, debited by payments made",
  vat_output: "VAT charged on sales", vat_input: "VAT paid on purchases", vat_settlement: "IVA paid to or refunded by the State",
  transfers_clearing: "Both sides of a transfer between own accounts",
  interest_expense: "Interest cover on the dashboard", interest_income: "Interest earned",
  default_sales: "Default account on a new sales invoice (one per business)",
  default_materials: "Default account on a new purchase invoice",
  wages_direct: "Gross pay of site and workshop staff", wages_office: "Gross pay of office staff",
  employer_social_security_direct: "Employer social security on direct staff", employer_social_security_office: "Employer social security on office staff",
  withholding_payable: "Tax withheld from pay, until paid to the State", social_security_payable: "Social security, until paid",
  net_pay_payable: "Net pay owed to staff, until paid", holiday_accrual: "Monthly build-up of holiday and Christmas pay",
  share_capital: "Where an opening balance for bank accounts is set against", retained_earnings: "Profit kept from earlier years",
  loan_principal: "Loan repayments reduce this account (the Loan instalment split)", bank_charges: "Bank fees (the Loan instalment split)", income_tax: "Tax on profits", petty_cash: "Default petty cash", client_money: "Money held for owners (Property management, Client account)",
}[role] ?? ""} |`).join("\n")}

## How payroll would post (the next change, once the chart is agreed)

One payroll entry per person per month, instead of single-account bank lines:

| | Debit | Credit |
|---|---|---|
| Gross pay | 6321 or 6322 | |
| Employer social security (about 23.75%) | 6351 or 6352 | |
| Net pay to the employee | | 2311 |
| Tax withheld (IRS) | | 2421 |
| Social security: employee share and employer share | | 2451 |
| Holiday and Christmas pay as duodecimos (a twelfth of each paid with the monthly salary) | 6321 or 6322, part of the gross | none needed |
| Paying the net pay | 2311 | bank |
| Paying the State | 2421, 2451 | bank |

## Questions for you and your accountant

1. ANSWERED (Tony, 2026-11-25): no SAF-T reporting; the app is for management use. The SNC numbering stays only as a tidy structure.
2. ANSWERED: autonomous taxation is handled by the external accountants, so there is no account for it (8123 removed).
3. ANSWERED: sub-account numbers as drafted.
4. ANSWERED: retentions yes (2119, 2212 stay in the Construction template); no work in progress (3610 removed).
5. ANSWERED: client money exists only in Casas Algarve and the Client Account company; Teia, Woodgrain and Algarve Interior do not use it (2788 stays in templates P and K only).
6. ANSWERED: stock for Teia and Woodgrain only (3210 stays in C and W, removed from I, P, K).
7. ANSWERED: monthly for some companies and quarterly for others (a setting per company); non-deductible VAT is left to the external accountants.
8. OPEN: Tony will check once the last changes are in and the sample data has run.

## What happens if you approve

1. I turn this data into the seed for each company and give subgroups and accounts their roles.
2. The app's code switches from hard-coded numbers to roles (the work I skipped over before).
3. Payroll entry and the VAT-on-direct-entries fix follow.
4. The sample data is rebuilt on the new chart.

Because you will start fresh, nothing has to be converted.
`;
fs.writeFileSync(path.join(docs, "chart-of-accounts-DRAFT.md"), md);
console.log(`ok: ${A.length} accounts, ${SUBGROUPS.length} subgroups, ${OLD.length} old accounts mapped`);
for (const [k, v] of Object.entries(TEMPLATES)) console.log(`  ${v}: ${count(k)}`);
