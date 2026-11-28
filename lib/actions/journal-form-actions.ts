"use server";

import { redirect } from "next/navigation";
import { createJournalEntry, updateJournalEntry, deleteJournalEntry, deleteJournalGroup, type JournalEntryInput } from "@/lib/actions/journal-actions";

function toInput(fd: FormData): JournalEntryInput {
  return {
    date: String(fd.get("date") || ""),
    account_no: Number(fd.get("account_no")),
    description: String(fd.get("description") || "").trim() || null,
    vat_perc: fd.get("vat_perc") ? Number(fd.get("vat_perc")) : null,
    debit: Number(fd.get("debit") || 0),
    credit: Number(fd.get("credit") || 0),
  };
}

function validate(input: JournalEntryInput): string | undefined {
  if (!input.date) return "Date is required.";
  if (!input.account_no) return "Select an account.";
  if (input.debit === 0 && input.credit === 0) return "Enter a debit or credit amount.";
}

export async function createJournalEntryFormAction(
  _prev: { error?: string; success?: boolean } | undefined,
  fd: FormData
) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    await createJournalEntry(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the entry." };
  }
  return { success: true };
}

export async function updateJournalEntryFormAction(id: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    await updateJournalEntry(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the entry." };
  }
  redirect("/journal");
}

export async function deleteJournalGroupAction(entryId: string) {
  await deleteJournalGroup(entryId);
}

export async function deleteJournalEntryAction(id: number) {
  await deleteJournalEntry(id);
}
