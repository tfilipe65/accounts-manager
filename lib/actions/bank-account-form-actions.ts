"use server";

import {
  createBankAccount,
  updateBankAccount,
  setBankAccountActive,
  deleteBankAccount,
} from "@/lib/actions/bank-account-actions";

type FormState = { error?: string; success?: boolean } | undefined;

function str(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) || "").trim();
  return v || null;
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function createBankAccountFormAction(_prev: FormState, fd: FormData) {
  try {
    await createBankAccount({
      name: String(fd.get("name") || ""),
      bank_name: str(fd, "bank_name"),
      iban: str(fd, "iban"),
      notes: str(fd, "notes"),
      is_cash: fd.get("kind") === "cash",
      chart_account_no: fd.get("chart_account_no") ? Number(fd.get("chart_account_no")) : null,
      opening_balance: Number(fd.get("opening_balance") || 0),
      opening_date: String(fd.get("opening_date") || ""),
      opening_counter_account_no: fd.get("opening_counter_account_no") ? Number(fd.get("opening_counter_account_no")) : null,
    });
  } catch (e) {
    return { error: message(e, "Could not add the account.") };
  }
  return { success: true };
}

export async function updateBankAccountFormAction(id: number, _prev: FormState, fd: FormData) {
  try {
    await updateBankAccount(id, {
      name: String(fd.get("name") || ""),
      bank_name: str(fd, "bank_name"),
      iban: str(fd, "iban"),
      notes: str(fd, "notes"),
      is_cash: fd.get("kind") === "cash",
    });
  } catch (e) {
    return { error: message(e, "Could not save the account.") };
  }
  return { success: true };
}

export async function setBankAccountActiveFormAction(id: number, active: boolean, _prev: FormState, _fd: FormData) {
  try {
    await setBankAccountActive(id, active);
  } catch (e) {
    return { error: message(e, "Could not change the account.") };
  }
  return { success: true };
}

export async function deleteBankAccountFormAction(id: number, _prev: FormState, _fd: FormData) {
  try {
    await deleteBankAccount(id);
  } catch (e) {
    return { error: message(e, "Could not delete the account.") };
  }
  return { success: true };
}
