"use server";

// Bank/cash registers. Accounts Manager.xlsb's better-engineered design --
// one unified register with an account selector -- rather than
// Teia_Accounts.xlsb's 3 hardcoded Bank_1/2/3 sheets + a separate Cash sheet.
// Each row is either a payment against a sales/purchase invoice (matched by
// id here, by invoice NUMBER text in the workbook) or a direct entry against
// a ledger account (bank charges, transfers, etc.) -- never more than one,
// enforced by the bank_transactions_one_link CHECK constraint.

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";

export type BankAccountSummary = {
  id: number;
  key: string;
  name: string;
  account_no: number;
  opening_balance: number;
  balance: number;
};

/** @param asOfDate Point-in-time cutoff ("YYYY-MM-DD") -- balance as it stood then, not as of now. Defaults to no cutoff. */
export async function listBankAccounts(asOfDate?: string): Promise<BankAccountSummary[]> {
  await requireSession();
  const cutoff = asOfDate ?? null;
  const rows = await query<{ id: number; key: string; name: string; account_no: number; opening: string; moved: string }>(
    `
    SELECT ba.id, ba.key, ba.name, ba.account_no,
           COALESCE(ob.opening, 0) AS opening,
           COALESCE(bt.moved, 0) AS moved
    FROM bank_accounts ba
    LEFT JOIN (
      SELECT account_no, SUM(debit - credit) AS opening FROM opening_balances
      WHERE $1::date IS NULL OR date <= $1::date GROUP BY account_no
    ) ob ON ob.account_no = ba.account_no
    LEFT JOIN (
      SELECT bank_account_id, SUM(in_amount + in_vat - out_amount - out_vat) AS moved
      FROM bank_transactions WHERE $1::date IS NULL OR payment_date <= $1::date GROUP BY bank_account_id
    ) bt ON bt.bank_account_id = ba.id
    ORDER BY ba.id
  `,
    [cutoff]
  );
  return rows.map((r) => {
    const opening = Number(r.opening);
    const moved = Number(r.moved);
    return { id: r.id, key: r.key, name: r.name, account_no: r.account_no, opening_balance: opening, balance: opening + moved };
  });
}

export type BankTransactionRow = {
  id: number;
  payment_date: string;
  description: string | null;
  link_label: string | null; // e.g. "Sales Inv INV-001", "Acct 2000 General Sales"
  vat_perc: number | null;
  in_amount: number;
  in_vat: number;
  out_amount: number;
  out_vat: number;
};

/** @param year Restrict to transactions dated in this year; omit for every year ever. */
export async function listBankTransactions(bankAccountId: number, year?: number): Promise<BankTransactionRow[]> {
  await requireSession();
  const yearFilter = year ?? null;
  const rows = await query<{
    id: number;
    payment_date: string;
    description: string | null;
    sales_invoice_number: string | null;
    purchase_invoice_number: string | null;
    account_no: number | null;
    account_name: string | null;
    vat_perc: string | null;
    in_amount: string;
    in_vat: string;
    out_amount: string;
    out_vat: string;
  }>(
    `SELECT bt.id, bt.payment_date, bt.description,
            si.invoice_number AS sales_invoice_number,
            pi.invoice_number AS purchase_invoice_number,
            bt.account_no, a.name AS account_name,
            bt.vat_perc, bt.in_amount, bt.in_vat, bt.out_amount, bt.out_vat
     FROM bank_transactions bt
     LEFT JOIN sales_invoices si ON si.id = bt.sales_invoice_id
     LEFT JOIN purchase_invoices pi ON pi.id = bt.purchase_invoice_id
     LEFT JOIN accounts a ON a.account_no = bt.account_no
     WHERE bt.bank_account_id = $1 AND ($2::int IS NULL OR EXTRACT(YEAR FROM bt.payment_date) = $2::int)
     ORDER BY bt.payment_date, bt.id`,
    [bankAccountId, yearFilter]
  );
  return rows.map((r) => ({
    id: r.id,
    payment_date: r.payment_date,
    description: r.description,
    link_label: r.sales_invoice_number
      ? `Sales invoice ${r.sales_invoice_number}`
      : r.purchase_invoice_number
        ? `Purchase invoice ${r.purchase_invoice_number}`
        : r.account_no
          ? `${r.account_no} ${r.account_name ?? ""}`.trim()
          : null,
    vat_perc: r.vat_perc != null ? Number(r.vat_perc) : null,
    in_amount: Number(r.in_amount),
    in_vat: Number(r.in_vat),
    out_amount: Number(r.out_amount),
    out_vat: Number(r.out_vat),
  }));
}

export type BankTransactionInput = {
  bank_account_id: number;
  payment_date: string;
  description: string | null;
  link_type: "sales" | "purchase" | "account" | "none";
  sales_invoice_id: number | null;
  purchase_invoice_id: number | null;
  account_no: number | null;
  vat_perc: number | null;
  in_amount: number;
  in_vat: number;
  out_amount: number;
  out_vat: number;
};

function linkFields(input: BankTransactionInput) {
  return {
    sales_invoice_id: input.link_type === "sales" ? input.sales_invoice_id : null,
    purchase_invoice_id: input.link_type === "purchase" ? input.purchase_invoice_id : null,
    account_no: input.link_type === "account" ? input.account_no : null,
  };
}

export async function createBankTransaction(input: BankTransactionInput): Promise<void> {
  const session = await requireSession();
  await assertYearOpen(input.payment_date, session);
  const link = linkFields(input);
  await query(
    `INSERT INTO bank_transactions
      (bank_account_id, payment_date, description, sales_invoice_id, purchase_invoice_id, account_no, vat_perc, in_amount, in_vat, out_amount, out_vat)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.bank_account_id,
      input.payment_date,
      input.description,
      link.sales_invoice_id,
      link.purchase_invoice_id,
      link.account_no,
      input.vat_perc,
      input.in_amount,
      input.in_vat,
      input.out_amount,
      input.out_vat,
    ]
  );
  revalidatePath("/banking");
  revalidatePath("/income");
  revalidatePath("/expense");
}

export async function getBankTransaction(id: number): Promise<BankTransactionInput | null> {
  await requireSession();
  const row = await query<{
    bank_account_id: number;
    payment_date: string;
    description: string | null;
    sales_invoice_id: number | null;
    purchase_invoice_id: number | null;
    account_no: number | null;
    vat_perc: string | null;
    in_amount: string;
    in_vat: string;
    out_amount: string;
    out_vat: string;
  }>(
    `SELECT bank_account_id, payment_date, description, sales_invoice_id, purchase_invoice_id, account_no, vat_perc, in_amount, in_vat, out_amount, out_vat
     FROM bank_transactions WHERE id = $1`,
    [id]
  );
  if (!row[0]) return null;
  const r = row[0];
  const link_type: BankTransactionInput["link_type"] = r.sales_invoice_id
    ? "sales"
    : r.purchase_invoice_id
      ? "purchase"
      : r.account_no
        ? "account"
        : "none";
  return {
    bank_account_id: r.bank_account_id,
    payment_date: r.payment_date,
    description: r.description,
    link_type,
    sales_invoice_id: r.sales_invoice_id,
    purchase_invoice_id: r.purchase_invoice_id,
    account_no: r.account_no,
    vat_perc: r.vat_perc != null ? Number(r.vat_perc) : null,
    in_amount: Number(r.in_amount),
    in_vat: Number(r.in_vat),
    out_amount: Number(r.out_amount),
    out_vat: Number(r.out_vat),
  };
}

export async function updateBankTransaction(id: number, input: BankTransactionInput): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ payment_date: string }>("SELECT payment_date FROM bank_transactions WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.payment_date, session);
  await assertYearOpen(input.payment_date, session);
  const link = linkFields(input);
  await query(
    `UPDATE bank_transactions SET
       bank_account_id=$2, payment_date=$3, description=$4, sales_invoice_id=$5, purchase_invoice_id=$6,
       account_no=$7, vat_perc=$8, in_amount=$9, in_vat=$10, out_amount=$11, out_vat=$12
     WHERE id=$1`,
    [
      id,
      input.bank_account_id,
      input.payment_date,
      input.description,
      link.sales_invoice_id,
      link.purchase_invoice_id,
      link.account_no,
      input.vat_perc,
      input.in_amount,
      input.in_vat,
      input.out_amount,
      input.out_vat,
    ]
  );
  revalidatePath("/banking");
  revalidatePath("/income");
  revalidatePath("/expense");
}

export async function deleteBankTransaction(id: number): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ payment_date: string }>("SELECT payment_date FROM bank_transactions WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.payment_date, session);
  await query("DELETE FROM bank_transactions WHERE id = $1", [id]);
  revalidatePath("/banking");
  revalidatePath("/income");
  revalidatePath("/expense");
}

export async function listOpenSalesInvoiceOptions(): Promise<{ id: number; label: string }[]> {
  await requireSession();
  const rows = await query<{ id: number; invoice_number: string; customer_name: string }>(
    `SELECT si.id, si.invoice_number, c.name AS customer_name FROM sales_invoices si JOIN customers c ON c.id = si.customer_id ORDER BY si.date DESC`
  );
  return rows.map((r) => ({ id: r.id, label: `${r.invoice_number} — ${r.customer_name}` }));
}

export async function listOpenPurchaseInvoiceOptions(): Promise<{ id: number; label: string }[]> {
  await requireSession();
  const rows = await query<{ id: number; invoice_number: string; supplier_name: string }>(
    `SELECT pi.id, pi.invoice_number, s.name AS supplier_name FROM purchase_invoices pi JOIN suppliers s ON s.id = pi.supplier_id ORDER BY pi.date DESC`
  );
  return rows.map((r) => ({ id: r.id, label: `${r.invoice_number} — ${r.supplier_name}` }));
}
