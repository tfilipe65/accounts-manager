"use server";

// Balance Sheet as at the end of a reporting year (or today, for the current calendar year).
//
// Built from the cumulative Trial Balance (see trial-balance-actions.ts). That ledger never closes
// the profit and loss accounts into equity, so the sheet does it here: the P&L accounts' combined
// balance is the profit made since the opening balances. Profit up to the end of the previous year
// is shown as retained earnings, and this year's profit on its own line -- which makes
// assets = liabilities + equity hold whenever the trial balance itself balances.

import { requireSession } from "@/lib/auth";
import { getTrialBalance, type TrialBalanceRow } from "@/lib/actions/trial-balance-actions";
import { reportingYearCutoffDate } from "@/lib/reporting-year-utils";

export type BSLine = { subgroup_no: number; name: string; amount: number };

export type BalanceSheet = {
  year: number;
  asOf: string | null; // null = today
  currentAssets: BSLine[];
  nonCurrentAssets: BSLine[];
  liabilities: BSLine[];
  longTermDebt: BSLine[];
  equity: BSLine[];
  totalCurrentAssets: number;
  totalNonCurrentAssets: number;
  totalAssets: number;
  totalLiabilities: number;
  totalLongTermDebt: number;
  retainedPriorYears: number;
  resultOfYear: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  /** assets - (liabilities + equity); zero when the books balance. */
  difference: number;
  /** Balance of single subgroups the dashboard ratios need. */
  cash: number;
  receivables: number;
  inventory: number;
};

const INVENTORY_SUBGROUP = 90;
const CASH_SUBGROUP = 10;
const RECEIVABLES_SUBGROUP = 30;

/** Stock is a current asset whatever group an older chart filed it under. */
function sectionOf(r: TrialBalanceRow): number {
  return r.subgroup_no === INVENTORY_SUBGROUP ? 4 : r.group_no;
}

function signed(r: TrialBalanceRow): number {
  return r.normal_balance === "debit" ? r.debit - r.credit : r.credit - r.debit;
}

function totals(rows: TrialBalanceRow[], pick: (r: TrialBalanceRow) => boolean): { lines: BSLine[]; total: number } {
  const bySubgroup = new Map<number, BSLine>();
  for (const r of rows.filter(pick)) {
    const line = bySubgroup.get(r.subgroup_no) ?? { subgroup_no: r.subgroup_no, name: r.subgroup_name, amount: 0 };
    line.amount += signed(r);
    bySubgroup.set(r.subgroup_no, line);
  }
  const lines = Array.from(bySubgroup.values()).filter((l) => Math.abs(l.amount) > 0.005);
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}

/** The profit made since the opening balances, per the P&L accounts in a trial balance. */
function profitToDate(rows: TrialBalanceRow[]): number {
  return -rows.filter((r) => r.statement === "P&L").reduce((s, r) => s + (r.debit - r.credit), 0);
}

export async function getBalanceSheet(year: number): Promise<BalanceSheet> {
  await requireSession();
  const cutoff = reportingYearCutoffDate(year);
  const [now, prior] = await Promise.all([getTrialBalance(cutoff ?? undefined), getTrialBalance(`${year - 1}-12-31`)]);
  const rows = now.rows;

  const ca = totals(rows, (r) => r.statement === "Balance Sheet" && sectionOf(r) === 4);
  const nca = totals(rows, (r) => r.statement === "Balance Sheet" && sectionOf(r) === 5);
  const liab = totals(rows, (r) => r.statement === "Balance Sheet" && sectionOf(r) === 6);
  const ltd = totals(rows, (r) => r.statement === "Balance Sheet" && sectionOf(r) === 7);
  const eq = totals(rows, (r) => r.statement === "Balance Sheet" && sectionOf(r) === 8);

  const resultToDate = profitToDate(rows);
  const retainedPriorYears = profitToDate(prior.rows);
  const resultOfYear = resultToDate - retainedPriorYears;

  const totalAssets = ca.total + nca.total;
  const totalEquity = eq.total + retainedPriorYears + resultOfYear;
  const totalLiabilitiesAndEquity = liab.total + ltd.total + totalEquity;
  const balanceOf = (subgroup: number) => rows.filter((r) => r.subgroup_no === subgroup).reduce((s, r) => s + signed(r), 0);

  return {
    year,
    asOf: cutoff,
    currentAssets: ca.lines,
    nonCurrentAssets: nca.lines,
    liabilities: liab.lines,
    longTermDebt: ltd.lines,
    equity: eq.lines,
    totalCurrentAssets: ca.total,
    totalNonCurrentAssets: nca.total,
    totalAssets,
    totalLiabilities: liab.total,
    totalLongTermDebt: ltd.total,
    retainedPriorYears,
    resultOfYear,
    totalEquity,
    totalLiabilitiesAndEquity,
    difference: totalAssets - totalLiabilitiesAndEquity,
    cash: balanceOf(CASH_SUBGROUP),
    receivables: balanceOf(RECEIVABLES_SUBGROUP),
    inventory: balanceOf(INVENTORY_SUBGROUP),
  };
}
