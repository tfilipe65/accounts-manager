"use server";

import { redirect } from "next/navigation";
import { createOpeningBalance, updateOpeningBalance, deleteOpeningBalance, type OpeningBalanceInput } from "@/lib/actions/opening-balance-actions";

function toInput(fd: FormData): OpeningBalanceInput {
  return {
    date: String(fd.get("date") || ""),
    account_no: Number(fd.get("account_no")),
    description: String(fd.get("description") || "").trim() || null,
    debit: Number(fd.get("debit") || 0),
    credit: Number(fd.get("credit") || 0),
  };
}

function validate(input: OpeningBalanceInput): string | undefined {
  if (!input.date) return "Date is required.";
  if (!input.account_no) return "Select an account.";
  if (input.debit === 0 && input.credit === 0) return "Enter a debit or credit amount.";
}

export async function createOpeningBalanceFormAction(
  _prev: { error?: string; success?: boolean } | undefined,
  fd: FormData
) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    await createOpeningBalance(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the opening balance." };
  }
  return { success: true };
}

export async function updateOpeningBalanceFormAction(id: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    await updateOpeningBalance(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the opening balance." };
  }
  redirect("/opening-balance");
}

export async function deleteOpeningBalanceAction(id: number) {
  await deleteOpeningBalance(id);
}
