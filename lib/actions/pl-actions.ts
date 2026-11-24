"use server";

// Profit & Loss -- year-scoped (the P&L page, Income Statement, Summary and Dashboard all need "just
// this reporting year's activity", not a lifetime total -- see reporting-year.ts for how the year is
// chosen). Every figure comes from getStatement(), which builds the structure in lib/pl-structure.ts
// from ONE query, so no two pages can disagree about the same year.
//
// The query mirrors getTrialBalance()'s per-account pattern but restricted to P&L accounts and one
// year: journal entries, direct bank entries (a bank fee, income paid straight into the bank with no
// invoice raised), and the lines of sales and purchase invoices. Proforma invoices are quotes, not
// sales, so they never count.

import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildStatement, sum, zeros, type MonthlyLine, type PLLine, type PLStatement } from "@/lib/pl-structure";

export async function getStatement(year: number): Promise<PLStatement> {
  await requireSession();
  const rows = await query<{ subgroup_no: number; subgroup_name: string; group_no: number; month: number; net: string }>(
    `
    SELECT sg.subgroup_no, sg.name AS subgroup_name, sg.group_no, x.month, SUM(x.net) AS net
    FROM (
      SELECT EXTRACT(MONTH FROM je.date)::int AS month, a.subgroup_no, (je.debit - je.credit) AS net
      FROM journal_entries je JOIN accounts a ON a.account_no = je.account_no
      WHERE EXTRACT(YEAR FROM je.date) = $1
      UNION ALL
      SELECT EXTRACT(MONTH FROM bt.payment_date)::int, a.subgroup_no, (bt.out_amount + bt.out_vat - bt.in_amount - bt.in_vat)
      FROM bank_transactions bt JOIN accounts a ON a.account_no = bt.account_no
      WHERE bt.account_no IS NOT NULL AND EXTRACT(YEAR FROM bt.payment_date) = $1
      UNION ALL
      SELECT EXTRACT(MONTH FROM si.date)::int, a.subgroup_no, -(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc))
      FROM sales_invoice_lines sil
      JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      JOIN accounts a ON a.account_no = sil.account_no
      WHERE EXTRACT(YEAR FROM si.date) = $1 AND si.doc_type <> 'Proforma'
      UNION ALL
      SELECT EXTRACT(MONTH FROM pi.date)::int, a.subgroup_no, (pil.amount_inc_vat / (1 + pil.vat_perc))
      FROM purchase_invoice_lines pil
      JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      JOIN accounts a ON a.account_no = pil.account_no
      WHERE EXTRACT(YEAR FROM pi.date) = $1
    ) x
    JOIN account_subgroups sg ON sg.subgroup_no = x.subgroup_no
    WHERE sg.group_no IN (1, 2, 3)
    GROUP BY sg.subgroup_no, sg.name, sg.group_no, x.month
    `,
    [year]
  );

  const bySubgroup = new Map<number, MonthlyLine>();
  for (const r of rows) {
    let line = bySubgroup.get(r.subgroup_no);
    if (!line) {
      line = { subgroup_no: r.subgroup_no, subgroup_name: r.subgroup_name, group_no: r.group_no, net: zeros() };
      bySubgroup.set(r.subgroup_no, line);
    }
    line.net[r.month - 1] += Number(r.net);
  }
  return buildStatement(year, Array.from(bySubgroup.values()));
}

export type YearlyPL = {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingResult: number;
  otherIncome: number;
  otherExpenses: number;
  incomeBeforeTax: number;
  incomeTax: number;
  netIncome: number;
  totalIncome: number;
  totalCosts: number;
  operatingExpenseLines: PLLine[];
  otherExpenseLines: PLLine[];
};

/** The year's totals -- what the dashboard tiles and the P&L page headline show. */
export async function getYearlyPL(year: number): Promise<YearlyPL> {
  const s = await getStatement(year);
  return {
    revenue: sum(s.revenue),
    costOfSales: sum(s.costOfSales),
    grossProfit: sum(s.grossProfit),
    operatingExpenses: sum(s.operatingExpenses),
    operatingResult: sum(s.operatingResult),
    otherIncome: sum(s.otherIncome),
    otherExpenses: sum(s.otherExpenses),
    incomeBeforeTax: sum(s.incomeBeforeTax),
    incomeTax: sum(s.incomeTax),
    netIncome: sum(s.netIncome),
    totalIncome: sum(s.totalIncome),
    totalCosts: sum(s.totalCosts),
    operatingExpenseLines: s.operatingExpenseLines,
    otherExpenseLines: s.otherExpenseLines,
  };
}
