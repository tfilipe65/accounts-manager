"use server";

// Trial Balance -- computed, not stored (see the migration's header comment
// and [[project-accounts-manager]]: the workbook's own TB.bas derives this
// via SUMIFS over the registers, never storing it either).
//
// This schema doesn't post an explicit double-entry journal line for every
// invoice the way a textbook ledger would (neither does the workbook -- its
// Income/Expense sheets are registers, and TB.bas itself derives AR/AP/VAT
// postings from them via SUMIFS against the reserved account numbers, same
// as here). So each account's balance is assembled from whichever of these
// actually touch it:
//
//   1. opening_balances            (debit - credit), keyed by account_no
//   2. journal_entries             (debit - credit), keyed by account_no
//   3. bank_transactions           EVERY row moves its own bank_account's ledger account
//                                  (in - out), regardless of link type -- keyed via
//                                  bank_accounts.account_no, not bt.account_no.
//   4. bank_transactions           direct entries ALSO post the opposite side to the
//                                  named account_no: debit = out (money left the bank
//                                  for this account, e.g. an expense), credit = in
//                                  (money came in from this account, e.g. revenue).
//   5. sales_invoice_lines         revenue recognised: credits the line's own account_no
//   6. purchase_invoice_lines      expense recognised: debits the line's own account_no
//   7. AR (app_settings.account_no_ar)              debited by invoice gross, credited by payments linked to it
//   8. AP (app_settings.account_no_ap)               credited by invoice gross, debited by payments linked to it
//   9. Sales Tax Payable (...account_no_sales_tax_payable)      credited by VAT on sales_invoice_lines
//  10. Purchase Tax Payable (...account_no_purchase_tax_payable) debited by VAT on purchase_invoice_lines
//
// A first cut of this got #3 wrong (bank_transactions grouped by the linked
// account instead of the bank's own account, so an invoice payment silently
// never moved the bank balance at all) and #4's sign backwards. Caught by a
// stress test -- raise an invoice, part-pay it, and check the trial balance
// stays self-balancing at every step. It's the only way to actually verify
// this kind of formula: there's no independent "right answer" to check
// against, only the fact that debits must equal credits.
//
// 5-10 only count documents dated on or after the latest opening-balance date (see openingDate
// below). #7/#8 settle with money moving either way: a refund in against a purchase (or out
// against a sale) reduces what was paid.
//
// Every one of 4-9 is a LEFT JOIN against its own GROUP BY subquery -- never
// joined directly against accounts in a way that could fan out, since each
// subquery already collapses to one row per account_no before joining.

import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type TrialBalanceRow = {
  account_no: number;
  account_name: string;
  group_no: number;
  group_name: string;
  statement: "P&L" | "Balance Sheet";
  subgroup_no: number;
  subgroup_name: string;
  normal_balance: "debit" | "credit";
  debit: number;
  credit: number;
};

/**
 * @param asOfDate Point-in-time cutoff ("YYYY-MM-DD") -- when set, every
 * register is restricted to rows dated on or before this date, so the
 * result is the trial balance as it stood at that moment (still cumulative
 * since inception, exactly like a real trial balance -- see
 * reporting-year.ts's reportingYearCutoffDate(), which is what callers use
 * to turn "the year I picked in the nav" into this cutoff). `undefined`
 * (the default) means no cutoff -- as of right now, the existing behaviour.
 */
export async function getTrialBalance(asOfDate?: string): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }> {
  await requireSession();
  const cutoff = asOfDate ?? null;

  const settings = await queryOne<{
    account_no_ar: number | null;
    account_no_ap: number | null;
    account_no_sales_tax_payable: number | null;
    account_no_purchase_tax_payable: number | null;
  }>("SELECT account_no_ar, account_no_ap, account_no_sales_tax_payable, account_no_purchase_tax_payable FROM app_settings WHERE id = 1");

  // Documents dated before the opening balances are already carried inside them (e.g. the 2019
  // invoices still unpaid on 1 Jan 2020 sit in the opening AR/AP). They stay in the registers so
  // later payments can settle them and ageing sees them, but they must not post a second time here.
  const openingDate =
    (await queryOne<{ d: string | null }>("SELECT MAX(date)::text AS d FROM opening_balances"))?.d ?? null;

  const rows = await query<{
    account_no: number;
    account_name: string;
    group_no: number;
    group_name: string;
    statement: "P&L" | "Balance Sheet";
    subgroup_no: number;
    subgroup_name: string;
    normal_balance: "debit" | "credit";
    net: string;
  }>(
    `
    SELECT a.account_no, a.name AS account_name, g.group_no, g.name AS group_name, g.statement,
           sg.subgroup_no, sg.name AS subgroup_name, sg.normal_balance,
      (
        COALESCE(ob.net, 0)
        + COALESCE(je.net, 0)
        + COALESCE(bank_ledger.net, 0)
        + COALESCE(bt_direct.net, 0)
        - COALESCE(sil.net, 0)
        + COALESCE(pil.net, 0)
        + CASE WHEN a.account_no = $1 THEN COALESCE(ar.gross, 0) - COALESCE(ar_paid.paid, 0) ELSE 0 END
        - CASE WHEN a.account_no = $2 THEN COALESCE(ap.gross, 0) - COALESCE(ap_paid.paid, 0) ELSE 0 END
        - CASE WHEN a.account_no = $3 THEN COALESCE(sales_vat.vat, 0) ELSE 0 END
        + CASE WHEN a.account_no = $4 THEN COALESCE(purch_vat.vat, 0) ELSE 0 END
      ) AS net
    FROM accounts a
    JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
    JOIN account_groups g ON g.group_no = sg.group_no
    LEFT JOIN (
      SELECT account_no, SUM(debit - credit) AS net FROM opening_balances
      WHERE $5::date IS NULL OR date <= $5::date GROUP BY account_no
    ) ob ON ob.account_no = a.account_no
    LEFT JOIN (
      SELECT account_no, SUM(debit - credit) AS net FROM journal_entries
      WHERE $5::date IS NULL OR date <= $5::date GROUP BY account_no
    ) je ON je.account_no = a.account_no
    LEFT JOIN (
      SELECT ba.account_no, SUM(bt.in_amount + bt.in_vat - bt.out_amount - bt.out_vat) AS net
      FROM bank_transactions bt JOIN bank_accounts ba ON ba.id = bt.bank_account_id
      WHERE $5::date IS NULL OR bt.payment_date <= $5::date
      GROUP BY ba.account_no
    ) bank_ledger ON bank_ledger.account_no = a.account_no
    LEFT JOIN (
      SELECT account_no, SUM(out_amount + out_vat - in_amount - in_vat) AS net
      FROM bank_transactions WHERE account_no IS NOT NULL AND ($5::date IS NULL OR payment_date <= $5::date) GROUP BY account_no
    ) bt_direct ON bt_direct.account_no = a.account_no
    LEFT JOIN (
      SELECT sil.account_no, SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc)) AS net
      FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      WHERE ($5::date IS NULL OR si.date <= $5::date) AND ($6::date IS NULL OR si.date >= $6::date) GROUP BY sil.account_no
    ) sil ON sil.account_no = a.account_no
    LEFT JOIN (
      SELECT pil.account_no, SUM(pil.amount_inc_vat / (1 + pil.vat_perc)) AS net
      FROM purchase_invoice_lines pil JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      WHERE ($5::date IS NULL OR pi.date <= $5::date) AND ($6::date IS NULL OR pi.date >= $6::date) GROUP BY pil.account_no
    ) pil ON pil.account_no = a.account_no
    LEFT JOIN (
      SELECT SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc) * (1 + sil.vat_perc)) AS gross
      FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      WHERE ($5::date IS NULL OR si.date <= $5::date) AND ($6::date IS NULL OR si.date >= $6::date)
    ) ar ON true
    LEFT JOIN (
      SELECT SUM(in_amount + in_vat - out_amount - out_vat) AS paid FROM bank_transactions
      WHERE sales_invoice_id IS NOT NULL AND ($5::date IS NULL OR payment_date <= $5::date)
    ) ar_paid ON true
    LEFT JOIN (
      SELECT SUM(pil.amount_inc_vat) AS gross
      FROM purchase_invoice_lines pil JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      WHERE ($5::date IS NULL OR pi.date <= $5::date) AND ($6::date IS NULL OR pi.date >= $6::date)
    ) ap ON true
    LEFT JOIN (
      SELECT SUM(out_amount + out_vat - in_amount - in_vat) AS paid FROM bank_transactions
      WHERE purchase_invoice_id IS NOT NULL AND ($5::date IS NULL OR payment_date <= $5::date)
    ) ap_paid ON true
    LEFT JOIN (
      SELECT SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc) * sil.vat_perc) AS vat
      FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      WHERE ($5::date IS NULL OR si.date <= $5::date) AND ($6::date IS NULL OR si.date >= $6::date)
    ) sales_vat ON true
    LEFT JOIN (
      SELECT SUM(pil.amount_inc_vat - pil.amount_inc_vat / (1 + pil.vat_perc)) AS vat
      FROM purchase_invoice_lines pil JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      WHERE ($5::date IS NULL OR pi.date <= $5::date) AND ($6::date IS NULL OR pi.date >= $6::date)
    ) purch_vat ON true
    ORDER BY a.account_no
    `,
    [
      settings?.account_no_ar ?? 0,
      settings?.account_no_ap ?? 0,
      settings?.account_no_sales_tax_payable ?? 0,
      settings?.account_no_purchase_tax_payable ?? 0,
      cutoff,
      openingDate,
    ]
  );

  let totalDebit = 0;
  let totalCredit = 0;
  const tbRows: TrialBalanceRow[] = [];
  for (const r of rows) {
    const net = Number(r.net);
    if (Math.abs(net) < 0.005) continue; // zero-balance accounts don't clutter the trial balance
    const debit = net > 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    totalDebit += debit;
    totalCredit += credit;
    tbRows.push({
      account_no: r.account_no,
      account_name: r.account_name,
      group_no: r.group_no,
      group_name: r.group_name,
      statement: r.statement,
      subgroup_no: r.subgroup_no,
      subgroup_name: r.subgroup_name,
      normal_balance: r.normal_balance,
      debit,
      credit,
    });
  }

  return { rows: tbRows, totalDebit, totalCredit };
}
