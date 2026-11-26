"use server";

// Bank/cash registers -- one unified register with an account selector. Any number of bank
// accounts and cash boxes can exist (lib/actions/bank-account-actions.ts manages them); each is
// tied to its own ledger account in the chart.
// Each row is either a payment against a sales/purchase invoice (matched by id) or a direct
// entry against a ledger account (bank charges, wages, transfers, etc.) -- never more than one,
// enforced by the bank_transactions_one_link CHECK constraint. A direct entry can also name the
// employee it was for. The two legs of a transfer between our own accounts share a transfer_id, and the
// parts of a split transaction (lib/actions/split-actions.ts) share a split_id: together they are one
// line on the bank statement.

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";
import { requireAccountByRole } from "@/lib/roles";
import { withOverdraftGuard } from "@/lib/overdraft";

export type BankAccountSummary = {
  id: number;
  key: string;
  name: string;
  account_no: number;
  bank_name: string | null;
  iban: string | null;
  is_cash: boolean;
  active: boolean;
  opening_balance: number;
  balance: number;
  unreconciled: number;
};

/**
 * @param asOfDate Point-in-time cutoff ("YYYY-MM-DD") -- balance as it stood then, not as of now. Defaults to no cutoff.
 * @param includeInactive Closed accounts are hidden unless asked for.
 */
export async function listBankAccounts(asOfDate?: string, includeInactive = false): Promise<BankAccountSummary[]> {
  await requireSession();
  const cutoff = asOfDate ?? null;
  const rows = await query<{
    id: number;
    key: string;
    name: string;
    account_no: number;
    bank_name: string | null;
    iban: string | null;
    is_cash: boolean;
    active: boolean;
    opening: string;
    moved: string;
    unreconciled: string;
  }>(
    `
    SELECT ba.id, ba.key, ba.name, ba.account_no, ba.bank_name, ba.iban, ba.is_cash, ba.active,
           COALESCE(ob.opening, 0) AS opening,
           COALESCE(bt.moved, 0) AS moved,
           COALESCE(bt.unreconciled, 0) AS unreconciled
    FROM bank_accounts ba
    LEFT JOIN (
      SELECT account_no, SUM(debit - credit) AS opening FROM opening_balances
      WHERE $1::date IS NULL OR date <= $1::date GROUP BY account_no
    ) ob ON ob.account_no = ba.account_no
    LEFT JOIN (
      SELECT bank_account_id,
             SUM(in_amount + in_vat - out_amount - out_vat) AS moved,
             COUNT(DISTINCT COALESCE(split_id, id::text)) FILTER (WHERE NOT reconciled) AS unreconciled
      FROM bank_transactions WHERE $1::date IS NULL OR payment_date <= $1::date GROUP BY bank_account_id
    ) bt ON bt.bank_account_id = ba.id
    WHERE $2::boolean OR ba.active
    ORDER BY ba.is_cash, ba.id
  `,
    [cutoff, includeInactive]
  );
  return rows.map((r) => {
    const opening = Number(r.opening);
    const moved = Number(r.moved);
    return {
      id: r.id,
      key: r.key,
      name: r.name,
      account_no: r.account_no,
      bank_name: r.bank_name,
      iban: r.iban,
      is_cash: r.is_cash,
      active: r.active,
      opening_balance: opening,
      balance: opening + moved,
      unreconciled: Number(r.unreconciled),
    };
  });
}

export type BankTransactionRow = {
  id: number;
  payment_date: string;
  description: string | null;
  link_label: string | null; // e.g. "Sales invoice INV-001", "2000 General Sales", "Transfer"
  employee_name: string | null;
  transfer_id: string | null;
  /** Parts of one split transaction share this. */
  split_id: string | null;
  account_no: number | null;
  sales_invoice_id: number | null;
  purchase_invoice_id: number | null;
  employee_id: number | null;
  reconciled: boolean;
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
    employee_name: string | null;
    transfer_id: string | null;
    split_id: string | null;
    sales_invoice_id: number | null;
    purchase_invoice_id: number | null;
    employee_id: number | null;
    reconciled: boolean;
    vat_perc: string | null;
    in_amount: string;
    in_vat: string;
    out_amount: string;
    out_vat: string;
  }>(
    `SELECT bt.id, bt.payment_date, bt.description, bt.split_id, bt.sales_invoice_id, bt.purchase_invoice_id, bt.employee_id,
            si.invoice_number AS sales_invoice_number,
            pi.invoice_number AS purchase_invoice_number,
            bt.account_no, a.name AS account_name, e.name AS employee_name, bt.transfer_id, bt.reconciled,
            bt.vat_perc, bt.in_amount, bt.in_vat, bt.out_amount, bt.out_vat
     FROM bank_transactions bt
     LEFT JOIN sales_invoices si ON si.id = bt.sales_invoice_id
     LEFT JOIN purchase_invoices pi ON pi.id = bt.purchase_invoice_id
     LEFT JOIN accounts a ON a.account_no = bt.account_no
     LEFT JOIN employees e ON e.id = bt.employee_id
     WHERE bt.bank_account_id = $1 AND ($2::int IS NULL OR EXTRACT(YEAR FROM bt.payment_date) = $2::int)
     ORDER BY bt.payment_date, bt.id`,
    [bankAccountId, yearFilter]
  );
  return rows.map((r) => ({
    id: r.id,
    payment_date: r.payment_date,
    description: r.description,
    link_label: r.transfer_id
      ? "Transfer between accounts"
      : r.sales_invoice_number
        ? `Sales invoice ${r.sales_invoice_number}`
        : r.purchase_invoice_number
          ? `Purchase invoice ${r.purchase_invoice_number}`
          : r.account_no
            ? `${r.account_no} ${r.account_name ?? ""}`.trim()
            : null,
    employee_name: r.employee_name,
    transfer_id: r.transfer_id,
    split_id: r.split_id,
    account_no: r.account_no,
    sales_invoice_id: r.sales_invoice_id,
    purchase_invoice_id: r.purchase_invoice_id,
    employee_id: r.employee_id,
    reconciled: r.reconciled,
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
  employee_id: number | null;
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
    // An employee only makes sense on a direct entry (wages, expense refunds).
    employee_id: input.link_type === "account" ? input.employee_id : null,
  };
}

function revalidateBanking() {
  revalidatePath("/banking");
  revalidatePath("/income");
  revalidatePath("/expense");
  revalidatePath("/employees");
}

export async function createBankTransaction(input: BankTransactionInput): Promise<void> {
  const session = await requireSession();
  await assertYearOpen(input.payment_date, session);
  const link = linkFields(input);
  await withOverdraftGuard([input.bank_account_id], (tx) => tx.query(
    `INSERT INTO bank_transactions
      (bank_account_id, payment_date, description, sales_invoice_id, purchase_invoice_id, account_no, employee_id, vat_perc, in_amount, in_vat, out_amount, out_vat)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      input.bank_account_id,
      input.payment_date,
      input.description,
      link.sales_invoice_id,
      link.purchase_invoice_id,
      link.account_no,
      link.employee_id,
      input.vat_perc,
      input.in_amount,
      input.in_vat,
      input.out_amount,
      input.out_vat,
    ]
  ));
  revalidateBanking();
}

export async function getBankTransaction(id: number): Promise<(BankTransactionInput & { transfer_id: string | null }) | null> {
  await requireSession();
  const row = await query<{
    bank_account_id: number;
    payment_date: string;
    description: string | null;
    sales_invoice_id: number | null;
    purchase_invoice_id: number | null;
    account_no: number | null;
    employee_id: number | null;
    transfer_id: string | null;
    vat_perc: string | null;
    in_amount: string;
    in_vat: string;
    out_amount: string;
    out_vat: string;
  }>(
    `SELECT bank_account_id, payment_date, description, sales_invoice_id, purchase_invoice_id, account_no, employee_id, transfer_id,
            vat_perc, in_amount, in_vat, out_amount, out_vat
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
    employee_id: r.employee_id,
    transfer_id: r.transfer_id,
    vat_perc: r.vat_perc != null ? Number(r.vat_perc) : null,
    in_amount: Number(r.in_amount),
    in_vat: Number(r.in_vat),
    out_amount: Number(r.out_amount),
    out_vat: Number(r.out_vat),
  };
}

export async function updateBankTransaction(id: number, input: BankTransactionInput): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ bank_account_id: number; payment_date: string; transfer_id: string | null; split_id: string | null }>(
    "SELECT bank_account_id, payment_date, transfer_id, split_id FROM bank_transactions WHERE id = $1",
    [id]
  );
  if (existing?.transfer_id) throw new Error("A transfer has two sides. Delete it and enter it again to change it.");
  if (existing?.split_id) throw new Error("This line is one part of a split transaction. Edit the split instead.");
  if (existing) await assertYearOpen(existing.payment_date, session);
  await assertYearOpen(input.payment_date, session);
  const link = linkFields(input);
  await withOverdraftGuard([existing?.bank_account_id, input.bank_account_id], (tx) => tx.query(
    `UPDATE bank_transactions SET
       bank_account_id=$2, payment_date=$3, description=$4, sales_invoice_id=$5, purchase_invoice_id=$6,
       account_no=$7, employee_id=$8, vat_perc=$9, in_amount=$10, in_vat=$11, out_amount=$12, out_vat=$13
     WHERE id=$1`,
    [
      id,
      input.bank_account_id,
      input.payment_date,
      input.description,
      link.sales_invoice_id,
      link.purchase_invoice_id,
      link.account_no,
      link.employee_id,
      input.vat_perc,
      input.in_amount,
      input.in_vat,
      input.out_amount,
      input.out_vat,
    ]
  ));
  revalidateBanking();
}

export async function deleteBankTransaction(id: number): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ payment_date: string; transfer_id: string | null; split_id: string | null }>(
    "SELECT payment_date, transfer_id, split_id FROM bank_transactions WHERE id = $1",
    [id]
  );
  if (existing) await assertYearOpen(existing.payment_date, session);
  // Both sides of a transfer, and all the parts of a split, go together.
  const accounts = (
    await query<{ bank_account_id: number }>(
      `SELECT DISTINCT bank_account_id FROM bank_transactions
        WHERE id = $1 OR transfer_id = (SELECT transfer_id FROM bank_transactions WHERE id = $1) OR split_id = (SELECT split_id FROM bank_transactions WHERE id = $1)`,
      [id]
    )
  ).map((r) => r.bank_account_id);
  await withOverdraftGuard(accounts, async (tx) => {
    if (existing?.transfer_id) await tx.query("DELETE FROM bank_transactions WHERE transfer_id = $1", [existing.transfer_id]);
    else if (existing?.split_id) await tx.query("DELETE FROM bank_transactions WHERE split_id = $1", [existing.split_id]);
    else await tx.query("DELETE FROM bank_transactions WHERE id = $1", [id]);
  });
  revalidateBanking();
}

/** Tick / untick "matched against the bank statement". */
export async function setBankTransactionReconciled(id: number, reconciled: boolean): Promise<void> {
  await requireSession();
  // The parts of a split are one line on the statement: they are ticked together.
  await query(
    "UPDATE bank_transactions SET reconciled = $2 WHERE id = $1 OR split_id = (SELECT split_id FROM bank_transactions WHERE id = $1)",
    [id, reconciled]
  );
  revalidatePath("/banking");
}

/** Tick every line of this account dated on or before a statement date. */
export async function reconcileBankAccountThrough(bankAccountId: number, throughDate: string): Promise<number> {
  await requireSession();
  const rows = await query<{ id: number }>(
    "UPDATE bank_transactions SET reconciled = true WHERE bank_account_id = $1 AND NOT reconciled AND payment_date <= $2::date RETURNING id",
    [bankAccountId, throughDate]
  );
  revalidatePath("/banking");
  return rows.length;
}

export type TransferInput = {
  from_bank_account_id: number;
  to_bank_account_id: number;
  date: string;
  amount: number;
  description: string | null;
};

/** The ledger account both sides of a transfer post to (nets to zero). */
async function transferAccountNo(): Promise<number> {
  return requireAccountByRole("transfers_clearing", "Transfers between own accounts");
}

/** Move money between two of our own accounts: an "out" on one and an "in" on the other, tied together. */
export async function createTransfer(input: TransferInput): Promise<void> {
  const session = await requireSession();
  await assertYearOpen(input.date, session);
  if (input.from_bank_account_id === input.to_bank_account_id) throw new Error("Choose two different accounts.");
  if (!(input.amount > 0)) throw new Error("Enter an amount greater than zero.");
  const accountNo = await transferAccountNo();
  const names = await query<{ id: number; name: string }>("SELECT id, name FROM bank_accounts WHERE id = ANY($1::int[])", [
    [input.from_bank_account_id, input.to_bank_account_id],
  ]);
  const nameOf = (id: number) => names.find((n) => n.id === id)?.name ?? "account";
  const transferId = crypto.randomUUID();
  const note = input.description ? ` - ${input.description}` : "";
  await withOverdraftGuard([input.from_bank_account_id, input.to_bank_account_id], async (tx) => {
    await tx.query(
      `INSERT INTO bank_transactions (bank_account_id, payment_date, description, account_no, out_amount, transfer_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [input.from_bank_account_id, input.date, `Transfer to ${nameOf(input.to_bank_account_id)}${note}`, accountNo, input.amount, transferId]
    );
    await tx.query(
      `INSERT INTO bank_transactions (bank_account_id, payment_date, description, account_no, in_amount, transfer_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [input.to_bank_account_id, input.date, `Transfer from ${nameOf(input.from_bank_account_id)}${note}`, accountNo, input.amount, transferId]
    );
  });
  revalidateBanking();
}

export async function listOpenSalesInvoiceOptions(): Promise<{ id: number; label: string }[]> {
  await requireSession();
  const rows = await query<{ id: number; invoice_number: string; customer_name: string }>(
    `SELECT si.id, si.invoice_number, c.name AS customer_name FROM sales_invoices si JOIN customers c ON c.id = si.customer_id WHERE si.doc_type <> 'Proforma' ORDER BY si.date DESC`
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

export type ReconciliationFigures = { bookBalance: number; reconciledBalance: number; unreconciledCount: number };

/** Book balance against the balance of just the lines ticked as matched with the statement (every year, not only the one on screen). */
export async function getReconciliationFigures(bankAccountId: number): Promise<ReconciliationFigures> {
  await requireSession();
  const row = await queryOne<{ opening: string; moved: string; reconciled: string; unreconciled: string }>(
    `SELECT COALESCE((SELECT SUM(debit - credit) FROM opening_balances ob JOIN bank_accounts ba ON ba.account_no = ob.account_no WHERE ba.id = $1), 0) AS opening,
            COALESCE(SUM(in_amount + in_vat - out_amount - out_vat), 0) AS moved,
            COALESCE(SUM(in_amount + in_vat - out_amount - out_vat) FILTER (WHERE reconciled), 0) AS reconciled,
            COUNT(DISTINCT COALESCE(split_id, id::text)) FILTER (WHERE NOT reconciled) AS unreconciled
     FROM bank_transactions WHERE bank_account_id = $1`,
    [bankAccountId]
  );
  const opening = Number(row?.opening ?? 0);
  return {
    bookBalance: opening + Number(row?.moved ?? 0),
    reconciledBalance: opening + Number(row?.reconciled ?? 0),
    unreconciledCount: Number(row?.unreconciled ?? 0),
  };
}
