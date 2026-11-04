"use server";

// Manual double-entry (the workbook's Journal_Entry sheet). Flat register --
// one row per debit/credit line, no header/lines split needed.

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";

export type JournalEntryRow = {
  id: number;
  date: string;
  account_no: number;
  account_name: string;
  description: string | null;
  vat_perc: number | null;
  debit: number;
  credit: number;
};

/** @param year Restrict to entries dated in this year; omit for every year ever. */
export async function listJournalEntries(year?: number): Promise<JournalEntryRow[]> {
  await requireSession();
  const yearFilter = year ?? null;
  const rows = await query<Omit<JournalEntryRow, "vat_perc" | "debit" | "credit"> & { vat_perc: string | null; debit: string; credit: string }>(
    `SELECT je.id, je.date, je.account_no, a.name AS account_name, je.description, je.vat_perc, je.debit, je.credit
     FROM journal_entries je JOIN accounts a ON a.account_no = je.account_no
     WHERE $1::int IS NULL OR EXTRACT(YEAR FROM je.date) = $1::int
     ORDER BY je.date DESC, je.id DESC`,
    [yearFilter]
  );
  return rows.map((r) => ({ ...r, vat_perc: r.vat_perc != null ? Number(r.vat_perc) : null, debit: Number(r.debit), credit: Number(r.credit) }));
}

export type JournalEntryInput = {
  date: string;
  account_no: number;
  description: string | null;
  vat_perc: number | null;
  debit: number;
  credit: number;
};

export async function getJournalEntry(id: number): Promise<JournalEntryInput | null> {
  await requireSession();
  const row = await query<{ date: string; account_no: number; description: string | null; vat_perc: string | null; debit: string; credit: string }>(
    "SELECT date, account_no, description, vat_perc, debit, credit FROM journal_entries WHERE id = $1",
    [id]
  );
  if (!row[0]) return null;
  const r = row[0];
  return { date: r.date, account_no: r.account_no, description: r.description, vat_perc: r.vat_perc != null ? Number(r.vat_perc) : null, debit: Number(r.debit), credit: Number(r.credit) };
}

export async function updateJournalEntry(id: number, input: JournalEntryInput): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ date: string }>("SELECT date FROM journal_entries WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.date, session);
  await assertYearOpen(input.date, session);
  await query(`UPDATE journal_entries SET date=$2, account_no=$3, description=$4, vat_perc=$5, debit=$6, credit=$7 WHERE id=$1`, [
    id,
    input.date,
    input.account_no,
    input.description,
    input.vat_perc,
    input.debit,
    input.credit,
  ]);
  revalidatePath("/journal");
}

export async function createJournalEntry(input: JournalEntryInput): Promise<void> {
  const session = await requireSession();
  await assertYearOpen(input.date, session);
  await query(`INSERT INTO journal_entries (date, account_no, description, vat_perc, debit, credit) VALUES ($1,$2,$3,$4,$5,$6)`, [
    input.date,
    input.account_no,
    input.description,
    input.vat_perc,
    input.debit,
    input.credit,
  ]);
  revalidatePath("/journal");
}

export async function deleteJournalEntry(id: number): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ date: string }>("SELECT date FROM journal_entries WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.date, session);
  await query("DELETE FROM journal_entries WHERE id = $1", [id]);
  revalidatePath("/journal");
}
