"use server";

// Profit & Loss -- year-scoped (the P&L page and Dashboard both need "just
// this reporting year's activity", not a lifetime total -- see
// reporting-year.ts for how the year itself is chosen).
//
// Earlier this only summed sales_invoice_lines / purchase_invoice_lines, which
// silently dropped any Income/Cost-of-Sales/Expense account touched directly by
// a Journal Entry (e.g. depreciation) or a direct Banking entry (e.g. a bank
// fee, or income paid straight into the bank with no invoice raised) --
// exactly the kind of entry that's common for both of those things in real use.
// This mirrors getTrialBalance()'s per-account net pattern (journal_entries +
// direct bank_transactions + sales/purchase invoice lines) but restricted to
// P&L accounts (groups 1-3, where opening_balances/bank-ledger/AR-AP-VAT don't
// apply) and to one year.

import { requireSession } from "@/lib/auth";

export type PLSubgroupLine = { subgroup_no: number; subgroup_name: string; amount: number };
export type YearlyPL = {
  revenue: number;
  costOfSales: number;
  operatingExpenses: number;
  /** Same value as operatingExpenses -- for groups 1-3 there's no separate "other expenses" bucket, so the P&L page's "Total Expenses" row is just this. */
  totalExpenses: number;
  totalCosts: number;
  grossProfit: number;
  expensesBySubgroup: PLSubgroupLine[];
  netIncome: number;
};

export async function getYearlyPL(year: number): Promise<YearlyPL> {
  await requireSession();
  const { query } = await import("@/lib/db");

  const rows = await query<{ group_no: number; subgroup_no: number; subgroup_name: string; net: string }>(
    `
    SELECT sg.group_no, sg.subgroup_no, sg.name AS subgroup_name,
      SUM(
        COALESCE(je.net, 0) + COALESCE(bt.net, 0) - COALESCE(sil.net, 0) + COALESCE(pil.net, 0)
      ) AS net
    FROM accounts a
    JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
    LEFT JOIN (
      SELECT account_no, SUM(debit - credit) AS net FROM journal_entries
      WHERE EXTRACT(YEAR FROM date) = $1 GROUP BY account_no
    ) je ON je.account_no = a.account_no
    LEFT JOIN (
      SELECT account_no, SUM(out_amount + out_vat - in_amount - in_vat) AS net FROM bank_transactions
      WHERE account_no IS NOT NULL AND EXTRACT(YEAR FROM payment_date) = $1 GROUP BY account_no
    ) bt ON bt.account_no = a.account_no
    LEFT JOIN (
      SELECT sil.account_no, SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc)) AS net
      FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      WHERE EXTRACT(YEAR FROM si.date) = $1 GROUP BY sil.account_no
    ) sil ON sil.account_no = a.account_no
    LEFT JOIN (
      SELECT pil.account_no, SUM(pil.amount_inc_vat / (1 + pil.vat_perc)) AS net
      FROM purchase_invoice_lines pil JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      WHERE EXTRACT(YEAR FROM pi.date) = $1 GROUP BY pil.account_no
    ) pil ON pil.account_no = a.account_no
    WHERE sg.group_no IN (1, 2, 3)
    GROUP BY sg.group_no, sg.subgroup_no, sg.name
    `,
    [year]
  );

  const byGroup = new Map<number, number>();
  for (const r of rows) byGroup.set(r.group_no, (byGroup.get(r.group_no) ?? 0) + Number(r.net));
  // Income (group 1) is credit-normal: net above is (debit - credit), so revenue is the negation.
  const revenue = -(byGroup.get(1) ?? 0);
  const costOfSales = byGroup.get(2) ?? 0;
  const operatingExpenses = byGroup.get(3) ?? 0;

  const expensesBySubgroup = rows
    .filter((r) => r.group_no === 3)
    .map((r) => ({ subgroup_no: r.subgroup_no, subgroup_name: r.subgroup_name, amount: Number(r.net) }))
    .filter((l) => Math.abs(l.amount) > 0.005)
    .sort((a, b) => b.amount - a.amount);

  const grossProfit = revenue - costOfSales;
  const netIncome = grossProfit - operatingExpenses;

  return {
    revenue,
    costOfSales,
    operatingExpenses,
    totalExpenses: operatingExpenses,
    totalCosts: costOfSales + operatingExpenses,
    grossProfit,
    expensesBySubgroup,
    netIncome,
  };
}
