"use server";

// The Checks page: proof that the books agree with themselves, and a list of things that look wrong.
//
//  * Reconciliations compare two independent calculations of the same thing (for example the profit
//    from the P&L against the movement of the P&L accounts in the trial balance). A difference means
//    a posting went somewhere unexpected.
//  * Data checks look for entries that are probably mistakes: overpaid invoices, accounts overdrawn,
//    transfers missing a side, entries dated in the future, and so on.

import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { listBankAccounts } from "@/lib/actions/banking-actions";
import { getTrialBalance } from "@/lib/actions/trial-balance-actions";
import { getBalanceSheet } from "@/lib/actions/balance-sheet-actions";
import { getStatement } from "@/lib/actions/pl-actions";
import { reportingYearCutoffDate } from "@/lib/reporting-year-utils";
import { sum } from "@/lib/pl-structure";

export type Reconciliation = { label: string; left: number; leftLabel: string; right: number; rightLabel: string; difference: number; note?: string };
export type DataCheck = { key: string; title: string; status: "ok" | "warn" | "error"; count: number; detail: string; examples: string[] };

export type ChecksResult = { year: number; reconciliations: Reconciliation[]; dataChecks: DataCheck[]; problems: number };

async function dataCheck(key: string, title: string, severity: "warn" | "error", okText: string, badText: string, sql: string, params: unknown[] = []): Promise<DataCheck> {
  const rows = await query<{ label: string }>(sql, params);
  return {
    key,
    title,
    status: rows.length === 0 ? "ok" : severity,
    count: rows.length,
    detail: rows.length === 0 ? okText : badText,
    examples: rows.slice(0, 8).map((r) => r.label),
  };
}

export async function getChecks(year: number): Promise<ChecksResult> {
  await requireSession();
  const cutoff = reportingYearCutoffDate(year);
  const priorCutoff = `${year - 1}-12-31`;

  const [tb, tbPrior, bs, statement, banks] = await Promise.all([
    getTrialBalance(cutoff ?? undefined),
    getTrialBalance(priorCutoff),
    getBalanceSheet(year),
    getStatement(year),
    listBankAccounts(cutoff ?? undefined, true),
  ]);

  const reconciliations: Reconciliation[] = [];

  reconciliations.push({
    label: "Trial balance",
    left: tb.totalDebit,
    leftLabel: "Total debits",
    right: tb.totalCredit,
    rightLabel: "Total credits",
    difference: tb.totalDebit - tb.totalCredit,
  });

  reconciliations.push({
    label: "Balance sheet",
    left: bs.totalAssets,
    leftLabel: "Total assets",
    right: bs.totalLiabilitiesAndEquity,
    rightLabel: "Liabilities + equity",
    difference: bs.difference,
  });

  for (const b of banks) {
    const ledgerRow = tb.rows.find((r) => r.account_no === b.account_no);
    const ledger = ledgerRow ? ledgerRow.debit - ledgerRow.credit : 0;
    reconciliations.push({
      label: `${b.name}${b.active ? "" : " (closed)"}`,
      left: b.balance,
      leftLabel: "Register balance",
      right: ledger,
      rightLabel: `Ledger account ${b.account_no}`,
      difference: b.balance - ledger,
    });
  }

  const plMovement = (rows: typeof tb.rows) => -rows.filter((r) => r.statement === "P&L").reduce((s, r) => s + (r.debit - r.credit), 0);
  const netFromTrialBalance = plMovement(tb.rows) - plMovement(tbPrior.rows);
  reconciliations.push({
    label: `Profit ${year}`,
    left: sum(statement.netIncome),
    leftLabel: "Profit & Loss",
    right: netFromTrialBalance,
    rightLabel: "Trial balance movement",
    difference: sum(statement.netIncome) - netFromTrialBalance,
    note: "Invoices dated before the opening balances are inside those balances, so they are not in the trial balance. For the first year that can explain a difference.",
  });

  const today = new Date().toISOString().slice(0, 10);
  const dataChecks = await Promise.all([
    dataCheck(
      "overpaid-sales",
      "Sales invoices paid more than they are worth",
      "error",
      "No sales invoice is overpaid.",
      "These invoices have received more than their total. Check for a duplicated payment or a wrong invoice link.",
      `SELECT si.invoice_number || ' (' || c.name || ') paid ' || ROUND(pt.paid::numeric, 2) || ' of ' || ROUND(lt.gross::numeric, 2) AS label
       FROM sales_invoices si JOIN customers c ON c.id = si.customer_id
       JOIN (SELECT sales_invoice_id, SUM(quantity * price_ex_vat * (1 - discount_perc) * (1 + vat_perc)) AS gross FROM sales_invoice_lines GROUP BY 1) lt ON lt.sales_invoice_id = si.id
       JOIN (SELECT sales_invoice_id, SUM(in_amount + in_vat) AS paid FROM bank_transactions WHERE sales_invoice_id IS NOT NULL GROUP BY 1) pt ON pt.sales_invoice_id = si.id
       WHERE si.doc_type <> 'Credit Note' AND pt.paid > lt.gross + 0.005 ORDER BY si.date DESC`
    ),
    dataCheck(
      "overpaid-purchases",
      "Purchase invoices paid more than they are worth",
      "error",
      "No purchase invoice is overpaid.",
      "These invoices have been paid more than their total. Check for a duplicated payment or a wrong invoice link.",
      `SELECT pi.invoice_number || ' (' || s.name || ') paid ' || ROUND(pt.paid::numeric, 2) || ' of ' || ROUND(lt.gross::numeric, 2) AS label
       FROM purchase_invoices pi JOIN suppliers s ON s.id = pi.supplier_id
       JOIN (SELECT purchase_invoice_id, SUM(amount_inc_vat) AS gross FROM purchase_invoice_lines GROUP BY 1) lt ON lt.purchase_invoice_id = pi.id
       JOIN (SELECT purchase_invoice_id, SUM(out_amount + out_vat) AS paid FROM bank_transactions WHERE purchase_invoice_id IS NOT NULL GROUP BY 1) pt ON pt.purchase_invoice_id = pi.id
       WHERE pt.paid > lt.gross + 0.005 AND lt.gross > 0 ORDER BY pi.date DESC`
    ),
    dataCheck(
      "invoice-no-lines",
      "Invoices with no lines",
      "error",
      "Every invoice has at least one line.",
      "These invoices have a header but no lines, so they count for nothing. Add the lines or delete the invoice.",
      `SELECT 'Sales ' || si.invoice_number AS label FROM sales_invoices si WHERE NOT EXISTS (SELECT 1 FROM sales_invoice_lines l WHERE l.sales_invoice_id = si.id)
       UNION ALL
       SELECT 'Purchase ' || pi.invoice_number FROM purchase_invoices pi WHERE NOT EXISTS (SELECT 1 FROM purchase_invoice_lines l WHERE l.purchase_invoice_id = pi.id)`
    ),
    dataCheck(
      "income-account",
      "Sales lines booked to a non-income account",
      "warn",
      "All sales lines are booked to income accounts.",
      "These sales lines post to an account that is not an income account, so they will not show as revenue.",
      `SELECT si.invoice_number || ' line ' || sil.line_no || ' -> account ' || sil.account_no AS label
       FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id
       JOIN accounts a ON a.account_no = sil.account_no JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
       WHERE sg.group_no <> 1 AND si.doc_type <> 'Proforma' ORDER BY si.date DESC`
    ),
    dataCheck(
      "overdrawn",
      "Bank accounts below zero",
      "warn",
      "No bank account or cash box is below zero.",
      "These accounts show a negative balance. For a bank account that may be an overdraft; for petty cash it usually means a missing entry.",
      `SELECT ba.name || ' ' || ROUND(bal.balance::numeric, 2) AS label FROM bank_accounts ba
       JOIN (SELECT ba2.id,
                    COALESCE((SELECT SUM(debit - credit) FROM opening_balances ob WHERE ob.account_no = ba2.account_no), 0)
                  + COALESCE((SELECT SUM(in_amount + in_vat - out_amount - out_vat) FROM bank_transactions bt WHERE bt.bank_account_id = ba2.id), 0) AS balance
             FROM bank_accounts ba2) bal ON bal.id = ba.id
       WHERE ba.active AND bal.balance < -0.005`
    ),
    dataCheck(
      "broken-transfer",
      "Transfers missing a side",
      "error",
      "Every transfer has both sides and they agree.",
      "These transfers have only one side or the two sides differ. Delete the transfer and enter it again.",
      `SELECT 'Transfer ' || LEFT(transfer_id, 8) || ' (' || COUNT(*) || ' lines)' AS label FROM bank_transactions
       WHERE transfer_id IS NOT NULL GROUP BY transfer_id
       HAVING COUNT(*) <> 2 OR ABS(SUM(in_amount + in_vat - out_amount - out_vat)) > 0.005`
    ),
    dataCheck(
      "future-dated",
      "Entries dated in the future",
      "warn",
      "Nothing is dated in the future.",
      "These entries are dated after today. That is often a typo in the year.",
      `SELECT 'Bank ' || payment_date || ' ' || COALESCE(description, '') AS label FROM bank_transactions WHERE payment_date > $1::date
       UNION ALL SELECT 'Sales ' || invoice_number || ' ' || date FROM sales_invoices WHERE date > $1::date
       UNION ALL SELECT 'Purchase ' || invoice_number || ' ' || date FROM purchase_invoices WHERE date > $1::date`,
      [today]
    ),
    dataCheck(
      "old-unreconciled",
      "Bank lines not matched with the statement for over 60 days (accounts you reconcile)",
      "warn",
      "Everything older than 60 days has been matched with a statement.",
      "These bank lines are over 60 days old and still not ticked as matched. Either tick them or look for a missing statement line.",
      `SELECT ba.name || ' ' || bt.payment_date || ' ' || COALESCE(bt.description, '') AS label
       FROM bank_transactions bt JOIN bank_accounts ba ON ba.id = bt.bank_account_id
       WHERE NOT bt.reconciled AND bt.payment_date < $1::date - 60
         AND EXISTS (SELECT 1 FROM bank_transactions r WHERE r.bank_account_id = bt.bank_account_id AND r.reconciled)
       ORDER BY bt.payment_date`,
      [today]
    ),
    dataCheck(
      "unlinked-employee",
      "Wages without an employee",
      "warn",
      "Every payroll payment names an employee.",
      "These bank entries are booked to a payroll account but do not say which employee they were for.",
      `SELECT bt.payment_date || ' ' || COALESCE(bt.description, '') || ' (' || a.name || ')' AS label
       FROM bank_transactions bt JOIN accounts a ON a.account_no = bt.account_no
       WHERE a.subgroup_no = 310 AND bt.employee_id IS NULL AND bt.transfer_id IS NULL ORDER BY bt.payment_date DESC LIMIT 200`
    ),
  ]);

  const problems =
    reconciliations.filter((r) => Math.abs(r.difference) >= 0.005).length + dataChecks.filter((c) => c.status !== "ok").length;
  return { year, reconciliations, dataChecks, problems };
}
