"use server";

// Dashboard data. One function gathers everything the page shows, for the reporting year chosen in
// the nav. The rules that keep it trustworthy:
//
//   * Profit figures come from the one shared P&L structure (pl-actions.ts + lib/pl-structure.ts), so
//     Sales, Costs, Operating costs and Result always agree with the P&L, Income Statement and Summary.
//   * Balances and ageing are "as at" the end of the reporting year (today for the current year).
//   * Cash in / out leave out transfers between our own accounts.
//   * Overdue means past the due date (invoice date + payment terms), not merely outstanding.
//   * Proforma invoices are quotes and are never counted.
//   * Ratios come from lib/metrics.ts (balance sheet and P&L only, with the definitions explained there).

import { requireSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { listBankAccounts } from "@/lib/actions/banking-actions";
import { getReceivablesAgeing, getPayablesAgeing, getAgeingBucketTotals, type AgeingRow } from "@/lib/actions/ageing-actions";
import { getBalanceDiagnostics, type BalanceDiagnostics } from "@/lib/actions/balance-diagnostics-actions";
import { getStatement } from "@/lib/actions/pl-actions";
import { getBalanceSheet } from "@/lib/actions/balance-sheet-actions";
import { getVatReport } from "@/lib/actions/vat-report-actions";
import { reportingYearCutoffDate } from "@/lib/reporting-year-utils";
import { computeMetrics, yearDays, type Metric } from "@/lib/metrics";
import { sum, quarter, type PLStatement } from "@/lib/pl-structure";

export type OutstandingSummary = { count: number; overdueCount: number; amount: number; overdueAmount: number };
export type BucketTotal = { bucket: string; amount: number; count: number };
export type Ranked = { name: string; amount: number };
export type MonthlyPoint = {
  month: string;
  sales: number;
  costs: number;
  net: number;
  cumSales: number;
  cumCosts: number;
  cumNet: number;
  cashIn: number;
  cashOut: number;
  balance: number;
};
export type KeyFigures = { count: number; paidCount: number; outstandingCount: number; gross: number; paid: number; outstanding: number; percentOutstanding: number };

export type DashboardData = {
  reportingYear: number;
  asOf: string | null;
  defaultReportingYear: number;
  banks: { id: number; name: string; balance: number; isCash: boolean }[];
  totalCash: number;
  receivables: OutstandingSummary;
  payables: OutstandingSummary;
  statement: {
    revenue: number;
    costOfSales: number;
    grossProfit: number;
    operatingCosts: number;
    operatingResult: number;
    otherIncome: number;
    otherExpenses: number;
    incomeTax: number;
    netIncome: number;
    totalCosts: number;
    quarters: { label: string; revenue: number; costs: number; net: number }[];
  };
  /** Operating costs, as an amount and as a share of sales, plus the cost structure around it. */
  costShares: { label: string; amount: number; shareOfSales: number | null; shareOfCosts: number | null }[];
  operatingCostLines: { label: string; value: number; share: number | null }[];
  monthly: MonthlyPoint[];
  cash: { in: number; out: number; net: number; opening: number; closing: number };
  receivablesByBucket: BucketTotal[];
  payablesByBucket: BucketTotal[];
  keySales: KeyFigures;
  keyPurchases: KeyFigures;
  vat: { onSales: number; onPurchases: number; due: number; paid: number; balance: number };
  topClients: Ranked[];
  topSuppliers: Ranked[];
  topProjects: Ranked[];
  metrics: Metric[];
  diagnostics: BalanceDiagnostics;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function summarize(rows: AgeingRow[]): OutstandingSummary {
  const overdue = rows.filter((r) => r.days_overdue > 0);
  return {
    count: rows.length,
    overdueCount: overdue.length,
    amount: rows.reduce((s, r) => s + r.outstanding, 0),
    overdueAmount: overdue.reduce((s, r) => s + r.outstanding, 0),
  };
}

async function withCounts(rows: AgeingRow[]): Promise<BucketTotal[]> {
  const totals = await getAgeingBucketTotals(rows);
  return totals.map((t) => ({ ...t, count: rows.filter((r) => r.bucket === t.bucket).length }));
}

// The years the picker offers: every year from five back to two ahead of the current year, widened to
// cover any year that has data or that Settings points at, with no gaps.
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
  const current = new Date().getFullYear();
  const known = [...rows.map((r) => r.year), settings?.reporting_year ?? current, current];
  const first = Math.min(current - 5, ...known);
  const last = Math.max(current + 2, ...known);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

async function keyFigures(kind: "sales" | "purchases", year: number, cutoff: string | null): Promise<KeyFigures> {
  const rows =
    kind === "sales"
      ? await query<{ gross: string; paid: string; doc_type: string }>(
          `SELECT si.doc_type, COALESCE(lt.gross, 0) AS gross, COALESCE(pt.paid, 0) AS paid
           FROM sales_invoices si
           LEFT JOIN (SELECT sales_invoice_id, SUM(quantity * price_ex_vat * (1 - discount_perc) * (1 + vat_perc)) AS gross
                      FROM sales_invoice_lines GROUP BY sales_invoice_id) lt ON lt.sales_invoice_id = si.id
           LEFT JOIN (SELECT sales_invoice_id, SUM(in_amount + in_vat) AS paid FROM bank_transactions
                      WHERE sales_invoice_id IS NOT NULL AND ($2::date IS NULL OR payment_date <= $2::date) GROUP BY sales_invoice_id) pt
                  ON pt.sales_invoice_id = si.id
           WHERE EXTRACT(YEAR FROM si.date) = $1 AND si.doc_type <> 'Proforma'`,
          [year, cutoff]
        )
      : await query<{ gross: string; paid: string; doc_type: string }>(
          `SELECT 'Invoice' AS doc_type, COALESCE(lt.gross, 0) AS gross, COALESCE(pt.paid, 0) AS paid
           FROM purchase_invoices pi
           LEFT JOIN (SELECT purchase_invoice_id, SUM(amount_inc_vat) AS gross FROM purchase_invoice_lines GROUP BY purchase_invoice_id) lt
                  ON lt.purchase_invoice_id = pi.id
           LEFT JOIN (SELECT purchase_invoice_id, SUM(out_amount + out_vat) AS paid FROM bank_transactions
                      WHERE purchase_invoice_id IS NOT NULL AND ($2::date IS NULL OR payment_date <= $2::date) GROUP BY purchase_invoice_id) pt
                  ON pt.purchase_invoice_id = pi.id
           WHERE EXTRACT(YEAR FROM pi.date) = $1`,
          [year, cutoff]
        );

  let count = 0;
  let paidCount = 0;
  let gross = 0;
  let paid = 0;
  for (const r of rows) {
    const g = Number(r.gross);
    const p = Number(r.paid);
    gross += g;
    paid += p;
    if (r.doc_type === "Credit Note") continue; // a credit note is not an invoice to be paid
    count += 1;
    if (g - p < 0.005) paidCount += 1;
  }
  const outstanding = gross - paid;
  return { count, paidCount, outstandingCount: count - paidCount, gross, paid, outstanding, percentOutstanding: gross > 0.005 ? outstanding / gross : 0 };
}

async function topRanked(sql: string, params: unknown[]): Promise<Ranked[]> {
  const rows = await query<{ name: string; amount: string }>(sql, params);
  return rows.map((r) => ({ name: r.name, amount: Number(r.amount) }));
}

async function cashByMonth(year: number): Promise<{ cashIn: number[]; cashOut: number[]; net: number[] }> {
  const rows = await query<{ month: number; cash_in: string | null; cash_out: string | null; net: string | null }>(
    `SELECT EXTRACT(MONTH FROM payment_date)::int AS month,
            SUM(in_amount + in_vat) FILTER (WHERE transfer_id IS NULL) AS cash_in,
            SUM(out_amount + out_vat) FILTER (WHERE transfer_id IS NULL) AS cash_out,
            SUM(in_amount + in_vat - out_amount - out_vat) AS net
     FROM bank_transactions WHERE EXTRACT(YEAR FROM payment_date) = $1 GROUP BY 1`,
    [year]
  );
  const cashIn = Array(12).fill(0);
  const cashOut = Array(12).fill(0);
  const net = Array(12).fill(0);
  for (const r of rows) {
    cashIn[r.month - 1] = Number(r.cash_in ?? 0);
    cashOut[r.month - 1] = Number(r.cash_out ?? 0);
    net[r.month - 1] = Number(r.net ?? 0);
  }
  return { cashIn, cashOut, net };
}

/** What the year's activity booked to one ledger account cost, any route (journal, bank entry, purchase invoice line). */
async function yearCostOfAccount(accountNo: number | null, year: number): Promise<number> {
  if (accountNo == null) return 0;
  const row = await queryOne<{ amount: string }>(
    `SELECT COALESCE((SELECT SUM(debit - credit) FROM journal_entries WHERE account_no = $1 AND EXTRACT(YEAR FROM date) = $2), 0)
          + COALESCE((SELECT SUM(out_amount + out_vat - in_amount - in_vat) FROM bank_transactions WHERE account_no = $1 AND EXTRACT(YEAR FROM payment_date) = $2), 0)
          + COALESCE((SELECT SUM(pil.amount_inc_vat / (1 + pil.vat_perc)) FROM purchase_invoice_lines pil
                      JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id WHERE pil.account_no = $1 AND EXTRACT(YEAR FROM pi.date) = $2), 0)
          AS amount`,
    [accountNo, year]
  );
  return Number(row?.amount ?? 0);
}

export async function getDashboard(yearOverride?: number): Promise<DashboardData> {
  await requireSession();

  const settings = await queryOne<{
    reporting_year: number;
    payment_term_days: number;
    account_no_vat_paid_received: number | null;
    account_no_interest_expense: number | null;
  }>("SELECT reporting_year, payment_term_days, account_no_vat_paid_received, account_no_interest_expense FROM app_settings WHERE id = 1");
  const year = yearOverride ?? settings?.reporting_year ?? new Date().getFullYear();
  const cutoff = reportingYearCutoffDate(year);

  const [statement, balanceSheet, banksAtEnd, banksBefore, receivables, payables, diagnostics, vatReport, cash] = await Promise.all([
    getStatement(year),
    getBalanceSheet(year),
    listBankAccounts(cutoff ?? undefined, false),
    listBankAccounts(`${year - 1}-12-31`, true),
    getReceivablesAgeing(cutoff ?? undefined),
    getPayablesAgeing(cutoff ?? undefined),
    getBalanceDiagnostics(),
    getVatReport(year),
    cashByMonth(year),
  ]);

  const [keySales, keyPurchases, topClients, topSuppliers, topProjects, vatPaid, interestPaid] = await Promise.all([
    keyFigures("sales", year, cutoff),
    keyFigures("purchases", year, cutoff),
    topRanked(
      `SELECT c.name, SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc)) AS amount
       FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id JOIN customers c ON c.id = si.customer_id
       WHERE EXTRACT(YEAR FROM si.date) = $1 AND si.doc_type <> 'Proforma'
       GROUP BY c.name HAVING SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc)) > 0 ORDER BY amount DESC, c.name LIMIT 10`,
      [year]
    ),
    topRanked(
      `SELECT s.name, SUM(pil.amount_inc_vat / (1 + pil.vat_perc)) AS amount
       FROM purchase_invoice_lines pil JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id JOIN suppliers s ON s.id = pi.supplier_id
       WHERE EXTRACT(YEAR FROM pi.date) = $1
       GROUP BY s.name HAVING SUM(pil.amount_inc_vat / (1 + pil.vat_perc)) > 0 ORDER BY amount DESC, s.name LIMIT 10`,
      [year]
    ),
    // Projects ranked by what they earned after what they cost, this year.
    topRanked(
      `SELECT name, SUM(amount) AS amount FROM (
         SELECT p.code || ' - ' || p.name AS name, sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc) AS amount
         FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id JOIN projects p ON p.id = sil.project_id
         WHERE EXTRACT(YEAR FROM si.date) = $1 AND si.doc_type <> 'Proforma'
         UNION ALL
         SELECT p.code || ' - ' || p.name, -(pil.amount_inc_vat / (1 + pil.vat_perc))
         FROM purchase_invoice_lines pil JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id JOIN projects p ON p.id = pil.project_id
         WHERE EXTRACT(YEAR FROM pi.date) = $1
       ) x GROUP BY name ORDER BY amount DESC, name LIMIT 10`,
      [year]
    ),
    // IVA settled with the tax authority during the year: direct bank entries and journal lines on the "IVA paid / received" account.
    settings?.account_no_vat_paid_received != null
      ? queryOne<{ amount: string }>(
          `SELECT COALESCE((SELECT SUM(out_amount + out_vat - in_amount - in_vat) FROM bank_transactions WHERE account_no = $1 AND EXTRACT(YEAR FROM payment_date) = $2), 0)
                + COALESCE((SELECT SUM(debit - credit) FROM journal_entries WHERE account_no = $1 AND EXTRACT(YEAR FROM date) = $2), 0) AS amount`,
          [settings.account_no_vat_paid_received, year]
        ).then((r) => Number(r?.amount ?? 0))
      : Promise.resolve(0),
    yearCostOfAccount(settings?.account_no_interest_expense ?? null, year),
  ]);

  const s: PLStatement = statement;
  const revenue = sum(s.revenue);
  const operatingCosts = sum(s.operatingExpenses);
  const costOfSales = sum(s.costOfSales);
  const otherExpenses = sum(s.otherExpenses);
  const incomeTax = sum(s.incomeTax);
  const totalCosts = sum(s.totalCosts);
  const share = (n: number, of: number): number | null => (of > 0.005 ? n / of : null);

  // Monthly series, with cumulative lines and the running cash balance.
  const openingCash = banksBefore.reduce((t, b) => t + b.balance, 0);
  let cumSales = 0;
  let cumCosts = 0;
  let balance = openingCash;
  const monthly: MonthlyPoint[] = MONTH_LABELS.map((label, i) => {
    const sales = s.revenue[i];
    const costs = s.totalCosts[i];
    cumSales += sales;
    cumCosts += costs;
    balance += cash.net[i];
    return {
      month: label,
      sales,
      costs,
      net: s.netIncome[i],
      cumSales,
      cumCosts,
      cumNet: cumSales + sum(s.otherIncome.slice(0, i + 1)) - cumCosts,
      cashIn: cash.cashIn[i],
      cashOut: cash.cashOut[i],
      balance,
    };
  });

  const { daysElapsed, daysInYear } = yearDays(year);
  const metrics = computeMetrics({
    daysElapsed,
    daysInYear,
    paymentTermDays: settings?.payment_term_days ?? 30,
    revenue,
    totalIncome: sum(s.totalIncome),
    costOfSales,
    grossProfit: sum(s.grossProfit),
    operatingResult: sum(s.operatingResult),
    netIncome: sum(s.netIncome),
    interestPaid,
    salesInvoicedInclVat: keySales.gross,
    currentAssets: balanceSheet.totalCurrentAssets,
    currentLiabilities: balanceSheet.totalLiabilities,
    inventory: balanceSheet.inventory,
    receivables: balanceSheet.receivables,
    nonCurrentAssets: balanceSheet.totalNonCurrentAssets,
    totalAssets: balanceSheet.totalAssets,
    liabilities: balanceSheet.totalLiabilities,
    longTermDebt: balanceSheet.totalLongTermDebt,
    equity: balanceSheet.totalEquity,
  });

  const [receivablesByBucket, payablesByBucket] = await Promise.all([withCounts(receivables.rows), withCounts(payables.rows)]);
  const vatDue = vatReport.totalNet;

  return {
    reportingYear: year,
    asOf: cutoff,
    defaultReportingYear: settings?.reporting_year ?? new Date().getFullYear(),
    banks: banksAtEnd.map((b) => ({ id: b.id, name: b.name, balance: b.balance, isCash: b.is_cash })),
    totalCash: banksAtEnd.reduce((t, b) => t + b.balance, 0),
    receivables: summarize(receivables.rows),
    payables: summarize(payables.rows),
    statement: {
      revenue,
      costOfSales,
      grossProfit: sum(s.grossProfit),
      operatingCosts,
      operatingResult: sum(s.operatingResult),
      otherIncome: sum(s.otherIncome),
      otherExpenses,
      incomeTax,
      netIncome: sum(s.netIncome),
      totalCosts,
      quarters: [1, 2, 3, 4].map((q) => ({ label: `Q${q}`, revenue: quarter(s.revenue, q), costs: quarter(s.totalCosts, q), net: quarter(s.netIncome, q) })),
    },
    costShares: [
      { label: "Cost of sales", amount: costOfSales },
      { label: "Operating costs", amount: operatingCosts },
      { label: "Other expenses & losses", amount: otherExpenses },
      { label: "Income tax", amount: incomeTax },
      { label: "Total costs", amount: totalCosts },
    ].map((c) => ({ ...c, shareOfSales: share(c.amount, revenue), shareOfCosts: share(c.amount, totalCosts) })),
    operatingCostLines: s.operatingExpenseLines.map((l) => ({ label: l.name, value: l.total, share: share(l.total, revenue) })),
    monthly,
    cash: {
      in: cash.cashIn.reduce((a, b) => a + b, 0),
      out: cash.cashOut.reduce((a, b) => a + b, 0),
      net: cash.cashIn.reduce((a, b) => a + b, 0) - cash.cashOut.reduce((a, b) => a + b, 0),
      opening: openingCash,
      closing: banksAtEnd.reduce((t, b) => t + b.balance, 0),
    },
    receivablesByBucket,
    payablesByBucket,
    keySales,
    keyPurchases,
    vat: { onSales: vatReport.totalOutput, onPurchases: vatReport.totalInput, due: vatDue, paid: vatPaid, balance: vatDue - vatPaid },
    topClients,
    topSuppliers,
    topProjects,
    metrics,
    diagnostics,
  };
}
