"use server";

// Opening balances (the workbook's Opening_balance sheet) -- the starting
// debit/credit per account when the books began, dated 2020-01-01 for this
// company. Flat register, no VAT (a balance carried forward isn't a taxable
// transaction).

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";

export type OpeningBalanceRow = {
  id: number;
  date: string;
  account_no: number;
  account_name: string;
  description: string | null;
  debit: number;
  credit: number;
};

/** @param year Restrict to rows dated in this year; omit for every year ever. */
export async function listOpeningBalances(year?: number): Promise<OpeningBalanceRow[]> {
  await requireSession();
  const yearFilter = year ?? null;
  const rows = await query<Omit<OpeningBalanceRow, "debit" | "credit"> & { debit: string; credit: string }>(
    `SELECT ob.id, ob.date, ob.account_no, a.name AS account_name, ob.description, ob.debit, ob.credit
     FROM opening_balances ob JOIN accounts a ON a.account_no = ob.account_no
     WHERE $1::int IS NULL OR EXTRACT(YEAR FROM ob.date) = $1::int
     ORDER BY ob.account_no`,
    [yearFilter]
  );
  return rows.map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit) }));
}

export type OpeningBalanceInput = {
  date: string;
  account_no: number;
  description: string | null;
  debit: number;
  credit: number;
};

export async function getOpeningBalance(id: number): Promise<OpeningBalanceInput | null> {
  await requireSession();
  const row = await query<{ date: string; account_no: number; description: string | null; debit: string; credit: string }>(
    "SELECT date, account_no, description, debit, credit FROM opening_balances WHERE id = $1",
    [id]
  );
  if (!row[0]) return null;
  const r = row[0];
  return { date: r.date, account_no: r.account_no, description: r.description, debit: Number(r.debit), credit: Number(r.credit) };
}

export async function updateOpeningBalance(id: number, input: OpeningBalanceInput): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ date: string }>("SELECT date FROM opening_balances WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.date, session);
  await assertYearOpen(input.date, session);
  await query(`UPDATE opening_balances SET date=$2, account_no=$3, description=$4, debit=$5, credit=$6 WHERE id=$1`, [
    id,
    input.date,
    input.account_no,
    input.description,
    input.debit,
    input.credit,
  ]);
  revalidatePath("/opening-balance");
}

export async function createOpeningBalance(input: OpeningBalanceInput): Promise<void> {
  const session = await requireSession();
  await assertYearOpen(input.date, session);
  await query(`INSERT INTO opening_balances (date, account_no, description, debit, credit) VALUES ($1,$2,$3,$4,$5)`, [
    input.date,
    input.account_no,
    input.description,
    input.debit,
    input.credit,
  ]);
  revalidatePath("/opening-balance");
}

export async function deleteOpeningBalance(id: number): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ date: string }>("SELECT date FROM opening_balances WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.date, session);
  await query("DELETE FROM opening_balances WHERE id = $1", [id]);
  revalidatePath("/opening-balance");
}
