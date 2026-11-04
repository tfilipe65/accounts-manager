"use server";

// Dashboard KPIs -- ported from the workbook's Dashboard sheet (see
// analysis/full/Dashboard.tsv): Bank/Cash balance, outstanding sales/purchase
// invoices (count + overdue count, amount + overdue amount), Result/Sales/
// Costs for the CURRENT REPORTING YEAR specifically (not all-time -- the
// sheet labels every one of these "Reporting year: X"), a Business Overhead %
// gauge, a Top 5 Best Customers list for the reporting year, monthly
// Sales/Costs/Cashflow series (calendar Jan-Dec of the reporting year, for
// the workbook's embedded Cashflow / Sales&Costs / Result charts), and
// outstanding-by-ageing-bucket totals for both AR and AP (the workbook's
// Ageing bar charts).
//
// "Sales" / "Costs" / "Business Overhead %" are all year-scoped P&L totals,
// via getYearlyPL() (lib/actions/pl-actions.ts) -- Sales = Income (group 1),
// Costs = Cost of Sales + Expenses (groups 2+3) combined, matching the
// workbook's simple headline pair. Business Overhead % = Operating Expenses
// (group 3 only, i.e. Costs minus Cost of Sales) / Sales, matching the intent
// of the workbook's Summary!F79/F64 (Operating Expenses / Revenue) -- this is
// now sourced from all P&L-account postings (invoices, journal entries, and
// direct Banking entries), not just invoices, so it agrees with the Profit &
// Loss page's numbers for the same year. See getYearlyPL's own header comment
// for the bug this fixed: invoice-only summing silently dropped bank fees and
// journal-entry postings (e.g. depreciation) made directly to P&L accounts.

import { requireSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { listBankAccounts } from "@/lib/actions/banking-actions";
import { getReceivablesAgeing, getPayablesAgeing, getAgeingBucketTotals } from "@/lib/actions/ageing-actions";
import { getBalanceDiagnostics, type BalanceDiagnostics } from "@/lib/actions/balance-diagnostics-actions";
import { getYearlyPL } from "@/lib/actions/pl-actions";
import { reportingYearCutoffDate } from "@/lib/reporting-year-utils";

export type OutstandingSummary = { count: number; overdueCount: number; amount: number; overdueAmount: number };
export type BestCustomer = { name: string; amount: number };
export type MonthlyPoint = { month: string; sales: number; costs: number; cashflow: number };
export type BucketTotal = { bucket: string; amount: number };

export type DashboardSummary = {
  totalCash: number;
  receivables: OutstandingSummary;
  payables: OutstandingSummary;
  reportingYear: number;
  /** app_settings.reporting_year -- the shared company-wide default, regardless of which year this call was asked to show. */
  defaultReportingYear: number;
  salesYtd: number;
  costsYtd: number;
  resultYtd: number;
  overheadPerc: number | null;
  bestCustomers: BestCustomer[];
  diagnostics: BalanceDiagnostics;
  monthly: MonthlyPoint[];
  receivablesByBucket: BucketTotal[];
  payablesByBucket: BucketTotal[];
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Calendar-year months (1-12), same simplifying assumption as vat-report-actions.ts:
// this company's fiscal year already starts in January.
//
// Sales/Costs here must stay month-by-month consistent with getYearlyPL()'s
// year totals above (same fix: journal entries and direct Banking postings to
// Income/Cost-of-Sales/Expense accounts count too, not just invoices) --
// otherwise the KPI tiles and this chart would silently disagree for any month
// with a non-invoice P&L posting.
async function getMonthlySeries(reportingYear: number): Promise<MonthlyPoint[]> {
  const plRows = await query<{ month: number; group_no: number; net: string }>(
    `
    SELECT month, group_no, SUM(net) AS net FROM (
      SELECT EXTRACT(MONTH FROM je.date)::int AS month, sg.group_no, (je.debit - je.credit) AS net
      FROM journal_entries je JOIN accounts a ON a.account_no = je.account_no JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
      WHERE EXTRACT(YEAR FROM je.date) = $1 AND sg.group_no IN (1, 2, 3)
      UNION ALL
      SELECT EXTRACT(MONTH FROM bt.payment_date)::int AS month, sg.group_no, (bt.out_amount + bt.out_vat - bt.in_amount - bt.in_vat) AS net
      FROM bank_transactions bt JOIN accounts a ON a.account_no = bt.account_no JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
      WHERE bt.account_no IS NOT NULL AND EXTRACT(YEAR FROM bt.payment_date) = $1 AND sg.group_no IN (1, 2, 3)
      UNION ALL
      SELECT EXTRACT(MONTH FROM si.date)::int AS month, sg.group_no, -(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc)) AS net
      FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      JOIN accounts a ON a.account_no = sil.account_no JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
      WHERE EXTRACT(YEAR FROM si.date) = $1
      UNION ALL
      SELECT EXTRACT(MONTH FROM pi.date)::int AS month, sg.group_no, (pil.amount_inc_vat / (1 + pil.vat_perc)) AS net
      FROM purchase_invoice_lines pil JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      JOIN accounts a ON a.account_no = pil.account_no JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
      WHERE EXTRACT(YEAR FROM pi.date) = $1
    ) x GROUP BY month, group_no`,
    [reportingYear]
  );
  const cashRows = await query<{ month: number; net: string }>(
    `SELECT EXTRACT(MONTH FROM payment_date)::int AS month, SUM(in_amount + in_vat - out_amount - out_vat) AS net
     FROM bank_transactions WHERE EXTRACT(YEAR FROM payment_date) = $1 GROUP BY 1`,
    [reportingYear]
  );

  // Income (group 1) is credit-normal, so its month total is the negation of the (debit - credit) net; Cost of Sales + Expenses (groups 2/3) sum directly.
  const salesByMonth = new Map<number, number>();
  const costsByMonth = new Map<number, number>();
  for (const r of plRows) {
    const net = Number(r.net);
    if (r.group_no === 1) salesByMonth.set(r.month, (salesByMonth.get(r.month) ?? 0) - net);
    else costsByMonth.set(r.month, (costsByMonth.get(r.month) ?? 0) + net);
  }
  const cashByMonth = new Map(cashRows.map((r) => [r.month, Number(r.net)]));

  return MONTH_LABELS.map((label, i) => ({
    month: label,
    sales: salesByMonth.get(i + 1) ?? 0,
    costs: costsByMonth.get(i + 1) ?? 0,
    cashflow: cashByMonth.get(i + 1) ?? 0,
  }));
}

function summarize(rows: { outstanding: number; days_overdue: number }[]): OutstandingSummary {
  const overdue = rows.filter((r) => r.days_overdue > 0);
  return {
    count: rows.length,
    overdueCount: overdue.length,
    amount: rows.reduce((s, r) => s + r.outstanding, 0),
    overdueAmount: overdue.reduce((s, r) => s + r.outstanding, 0),
  };
}

// Every year that actually has data, plus app_settings.reporting_year and the
// current calendar year (so the picker always offers somewhere sensible to
// land even on a freshly-seeded company with no transactions yet).
export async function getAvailableReportingYears(): Promise<number[]> {
  await requireSession();
  const settings = await queryOne<{ reporting_year: number }>("SELECT reporting_year FROM app_settings WHERE id = 1");
  const rows = await query<{ year: number }>(`
    SELECT EXTRACT(YEAR FROM date)::int AS year FROM journal_entries
    UNION SELECT EXTRACT(YEAR FROM date)::int FROM opening_balances
    UNION SELECT EXTRACT(YEAR FROM payment_date)::int FROM bank_transactions
    UNION SELECT EXTRACT(YEAR FROM date)::int FROM sales_invoices
    UNION SELECT EXTRACT(YEAR FROM date)::int FROM purchase_invoices
  `);
  const years = new Set(rows.map((r) => r.year));
  years.add(settings?.reporting_year ?? new Date().getFullYear());
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => a - b);
}

// `yearOverride` lets the Dashboard's year picker look at a different year
// than app_settings.reporting_year without changing that shared company-wide
// setting -- a per-view choice, not a persisted one (same as picking a
// different bank account tab on the Banking page).
export async function getDashboardSummary(yearOverride?: number): Promise<DashboardSummary> {
  await requireSession();

  const settings = await queryOne<{ reporting_year: number }>("SELECT reporting_year FROM app_settings WHERE id = 1");
  const reportingYear = yearOverride ?? settings?.reporting_year ?? new Date().getFullYear();
  const cutoff = reportingYearCutoffDate(reportingYear) ?? undefined;

  const [bankAccounts, receivables, payables, diagnostics] = await Promise.all([
    listBankAccounts(cutoff),
    getReceivablesAgeing(cutoff),
    getPayablesAgeing(cutoff),
    getBalanceDiagnostics(),
  ]);

  const yearlyPL = await getYearlyPL(reportingYear);
  const bestCustomersRows = await query<{ name: string; amount: string }>(
    `SELECT c.name, SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc)) AS amount
     FROM sales_invoice_lines sil
     JOIN sales_invoices si ON si.id = sil.sales_invoice_id
     JOIN customers c ON c.id = si.customer_id
     WHERE EXTRACT(YEAR FROM si.date) = $1
     GROUP BY c.name ORDER BY amount DESC LIMIT 5`,
    [reportingYear]
  );

  const salesYtd = yearlyPL.revenue;
  const costsYtd = yearlyPL.totalCosts;
  const overheadYtd = yearlyPL.operatingExpenses;

  const [monthly, receivablesByBucket, payablesByBucket] = await Promise.all([
    getMonthlySeries(reportingYear),
    getAgeingBucketTotals(receivables.rows),
    getAgeingBucketTotals(payables.rows),
  ]);

  return {
    totalCash: bankAccounts.reduce((s, b) => s + b.balance, 0),
    receivables: summarize(receivables.rows),
    payables: summarize(payables.rows),
    reportingYear,
    defaultReportingYear: settings?.reporting_year ?? new Date().getFullYear(),
    salesYtd,
    costsYtd,
    resultYtd: salesYtd - costsYtd,
    overheadPerc: salesYtd > 0 ? overheadYtd / salesYtd : null,
    bestCustomers: bestCustomersRows.map((r) => ({ name: r.name, amount: Number(r.amount) })),
    diagnostics,
    monthly,
    receivablesByBucket,
    payablesByBucket,
  };
}
