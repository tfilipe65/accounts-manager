"use server";

// Manual double-entry (the workbook's Journal_Entry sheet). Flat register --
// one row per debit/credit line, no header/lines split needed.

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction } from "@/lib/db";
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
  /** Lines entered together as one multi-line entry share this (payroll lines do too, and also name an employee). */
  entry_id: string | null;
  employee_id: number | null;
};

/** @param year Restrict to entries dated in this year; omit for every year ever. */
export async function listJournalEntries(year?: number): Promise<JournalEntryRow[]> {
  await requireSession();
  const yearFilter = year ?? null;
  const rows = await query<Omit<JournalEntryRow, "vat_perc" | "debit" | "credit"> & { vat_perc: string | null; debit: string; credit: string }>(
    `SELECT je.id, je.date, je.account_no, a.name AS account_name, je.description, je.vat_perc, je.debit, je.credit, je.entry_id, je.employee_id
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
  const existing = await queryOne<{ date: string; entry_id: string | null; employee_id: number | null }>("SELECT date, entry_id, employee_id FROM journal_entries WHERE id = $1", [id]);
  if (existing?.entry_id && !existing.employee_id) throw new Error("This line belongs to a multi-line entry. Edit the whole entry instead.");
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

// ---- Multi-line entries: several lines entered together that must balance (debits = credits) ----

function checkGroup(lines: JournalEntryInput[]): string | null {
  if (lines.length < 2) return "A multi-line entry needs at least two lines. For one line, use a normal entry.";
  let debit = 0;
  let credit = 0;
  for (const [i, l] of lines.entries()) {
    if (!l.date) return "Date is required.";
    if (!l.account_no) return `Line ${i + 1}: select an account.`;
    if (!(Math.abs(l.debit) > 0.0049 || Math.abs(l.credit) > 0.0049)) return `Line ${i + 1}: enter a debit or credit amount.`;
    debit += l.debit;
    credit += l.credit;
  }
  if (Math.abs(debit - credit) > 0.005) {
    return `The lines do not balance: debits ${debit.toFixed(2)}, credits ${credit.toFixed(2)} (difference ${(debit - credit).toFixed(2)}).`;
  }
  return null;
}

async function insertGroup(client: { query: (t: string, p?: unknown[]) => Promise<unknown> }, entryId: string, lines: JournalEntryInput[]) {
  for (const l of lines) {
    await client.query(
      `INSERT INTO journal_entries (date, account_no, description, vat_perc, debit, credit, entry_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [l.date, l.account_no, l.description, l.vat_perc, l.debit, l.credit, entryId]
    );
  }
}

export async function createJournalGroup(lines: JournalEntryInput[]): Promise<{ error?: string }> {
  const session = await requireSession();
  const problem = checkGroup(lines);
  if (problem) return { error: problem };
  try {
    await assertYearOpen(lines[0].date, session);
    const entryId = crypto.randomUUID();
    await withTransaction(async (client) => insertGroup(client, entryId, lines));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the entry." };
  }
  revalidatePath("/journal");
  return {};
}

export async function getJournalGroup(entryId: string): Promise<JournalEntryInput[] | null> {
  await requireSession();
  const rows = await query<{ date: string; account_no: number; description: string | null; vat_perc: string | null; debit: string; credit: string }>(
    "SELECT date, account_no, description, vat_perc, debit, credit FROM journal_entries WHERE entry_id = $1 AND employee_id IS NULL ORDER BY id",
    [entryId]
  );
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    date: r.date,
    account_no: r.account_no,
    description: r.description,
    vat_perc: r.vat_perc != null ? Number(r.vat_perc) : null,
    debit: Number(r.debit),
    credit: Number(r.credit),
  }));
}

export async function updateJournalGroup(entryId: string, lines: JournalEntryInput[]): Promise<{ error?: string }> {
  const session = await requireSession();
  const problem = checkGroup(lines);
  if (problem) return { error: problem };
  try {
    const old = await queryOne<{ date: string }>("SELECT MIN(date) AS date FROM journal_entries WHERE entry_id = $1 AND employee_id IS NULL", [entryId]);
    if (!old?.date) return { error: "That entry no longer exists." };
    await assertYearOpen(old.date, session);
    await assertYearOpen(lines[0].date, session);
    await withTransaction(async (client) => {
      await client.query("DELETE FROM journal_entries WHERE entry_id = $1 AND employee_id IS NULL", [entryId]);
      await insertGroup(client, entryId, lines);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the entry." };
  }
  revalidatePath("/journal");
  return {};
}

export async function deleteJournalGroup(entryId: string): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ date: string }>("SELECT MIN(date) AS date FROM journal_entries WHERE entry_id = $1 AND employee_id IS NULL", [entryId]);
  if (existing?.date) await assertYearOpen(existing.date, session);
  await query("DELETE FROM journal_entries WHERE entry_id = $1 AND employee_id IS NULL", [entryId]);
  revalidatePath("/journal");
}
