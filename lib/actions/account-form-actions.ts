"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAccount, updateAccount, deleteAccount, type AccountInput } from "@/lib/actions/account-actions";

function toInput(fd: FormData): AccountInput {
  return {
    account_no: Number(fd.get("account_no")),
    name: String(fd.get("name") || "").trim(),
    subgroup_no: Number(fd.get("subgroup_no")),
  };
}

function validate(input: AccountInput): string | undefined {
  if (!input.account_no) return "Account number is required.";
  if (!input.name) return "Account name is required.";
  if (!input.subgroup_no) return "Select a subgroup.";
}

export async function createAccountFormAction(_prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    await createAccount(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the account." };
  }
  redirect("/chart-of-accounts");
}

export async function updateAccountFormAction(originalAccountNo: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    await updateAccount(originalAccountNo, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the account." };
  }
  redirect("/chart-of-accounts");
}

/** Create (original = null) or update an account and stay on the page; used by the floating window. */
export async function saveAccountAction(originalAccountNo: number | null, _prev: { error?: string; success?: boolean } | undefined, fd: FormData) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    if (originalAccountNo == null) await createAccount(input);
    else await updateAccount(originalAccountNo, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the account." };
  }
  revalidatePath("/chart-of-accounts");
  return { success: true };
}

export async function deleteAccountAction(accountNo: number) {
  await deleteAccount(accountNo);
}
