"use server";

// Split transactions. One line on the bank statement divided between several accounts and/or invoices:
// a loan instalment (principal to the loan, interest and fees to expenses), a payment to the State
// (withheld tax and social security), one payment covering two invoices, a supplier payment less a credit.
//
// Stored as several bank_transactions rows that share a split_id, so the bank balance, reconciliation,
// trial balance, profit and loss and VAT report all see each part exactly as they see any other entry.
// The parts are entered including VAT; the VAT of an account line is separated out (it belongs on the
// VAT accounts, not in the expense). A line paying an invoice carries no VAT: that was recognised when
// the invoice was entered.

import { revalidatePath } from "next/cache";
import { query, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";
import { SPLIT_SEPARATOR } from "@/lib/banking-group";

export type SplitLine = {
  kind: "account" | "sales" | "purchase";
  account_no: number | null;
  sales_invoice_id: number | null;
  purchase_invoice_id: number | null;
  employee_id: number | null;
  description: string | null;
  /** Including VAT. Positive goes the way of the whole transaction; negative goes the other way (a credit). */
  amount: number;
  /** 0.23 for 23%. Only used on account lines. */
  vat_perc: number;
};

export type SplitInput = {
  bank_account_id: number;
  payment_date: string;
  description: string | null;
  direction: "in" | "out";
  /** What the bank statement shows (positive). The parts must add up to it. */
  total: number;
  lines: SplitLine[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function validate(input: SplitInput): string | null {
  if (!input.payment_date) return "Enter the date.";
  if (!(input.total > 0)) return "Enter the amount shown on the bank statement.";
  if (input.lines.length < 2) return "A split needs at least two parts. For one part, use a normal entry.";
  let sum = 0;
  for (const [i, l] of input.lines.entries()) {
    const n = i + 1;
    if (!Number.isFinite(l.amount) || Math.abs(l.amount) < 0.005) return `Part ${n}: enter an amount.`;
    if (l.kind === "account" && !l.account_no) return `Part ${n}: choose an account.`;
    if (l.kind === "sales" && !l.sales_invoice_id) return `Part ${n}: choose the sales invoice.`;
    if (l.kind === "purchase" && !l.purchase_invoice_id) return `Part ${n}: choose the purchase invoice.`;
    if (l.vat_perc < 0 || l.vat_perc >= 1) return `Part ${n}: the VAT rate must be between 0 and 99%.`;
    sum += l.amount;
  }
  if (Math.abs(sum - input.total) > 0.005) return `The parts add up to ${r2(sum).toFixed(2)} but the statement amount is ${r2(input.total).toFixed(2)}.`;
  return null;
}

type Tx = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

async function insertParts(tx: Tx, splitId: string, input: SplitInput, reconciled: boolean) {
  for (const l of input.lines) {
    // A part goes the way of the whole transaction when its sign is positive, and the other way (a credit within
    // the payment) when negative.
    const sideOut = l.amount > 0 === (input.direction === "out");
    const gross = Math.abs(l.amount);
    const isAccount = l.kind === "account";
    const net = isAccount ? r2(gross / (1 + l.vat_perc)) : gross;
    const vat = isAccount ? r2(gross - net) : 0;
    await tx.query(
      `INSERT INTO bank_transactions
        (bank_account_id, payment_date, description, sales_invoice_id, purchase_invoice_id, account_no, employee_id, vat_perc,
         in_amount, in_vat, out_amount, out_vat, split_id, reconciled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        input.bank_account_id,
        input.payment_date,
        (l.description ? `${input.description ?? ""}${SPLIT_SEPARATOR}${l.description}` : input.description) || null,
        l.kind === "sales" ? l.sales_invoice_id : null,
        l.kind === "purchase" ? l.purchase_invoice_id : null,
        isAccount ? l.account_no : null,
        isAccount ? l.employee_id : null,
        isAccount && l.vat_perc > 0 ? l.vat_perc : null,
        sideOut ? 0 : net,
        sideOut ? 0 : vat,
        sideOut ? net : 0,
        sideOut ? vat : 0,
        splitId,
        reconciled,
      ]
    );
  }
}

function refresh() {
  revalidatePath("/banking");
  revalidatePath("/income");
  revalidatePath("/expense");
  revalidatePath("/employees");
}

export async function createSplit(input: SplitInput): Promise<{ error?: string }> {
  const session = await requireSession();
  const problem = validate(input);
  if (problem) return { error: problem };
  try {
    await assertYearOpen(input.payment_date, session);
    await withTransaction(async (tx) => insertParts(tx as unknown as Tx, crypto.randomUUID(), input, false));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the split." };
  }
  refresh();
  return {};
}

export async function updateSplit(splitId: string, input: SplitInput): Promise<{ error?: string }> {
  const session = await requireSession();
  const problem = validate(input);
  if (problem) return { error: problem };
  try {
    const old = (await query<{ payment_date: string; reconciled: boolean }>("SELECT payment_date, reconciled FROM bank_transactions WHERE split_id = $1 LIMIT 1", [splitId]))[0];
    if (!old) return { error: "That split no longer exists." };
    await assertYearOpen(old.payment_date, session);
    await assertYearOpen(input.payment_date, session);
    await withTransaction(async (tx) => {
      await tx.query("DELETE FROM bank_transactions WHERE split_id = $1", [splitId]);
      await insertParts(tx as unknown as Tx, splitId, input, old.reconciled);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the split." };
  }
  refresh();
  return {};
}
