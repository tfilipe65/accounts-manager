"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createBankTransaction,
  updateBankTransaction,
  deleteBankTransaction,
  createTransfer,
  reconcileBankAccountThrough,
  type BankTransactionInput,
} from "@/lib/actions/banking-actions";

function toInput(fd: FormData): BankTransactionInput {
  const linkType = String(fd.get("link_type") || "none") as BankTransactionInput["link_type"];
  return {
    bank_account_id: Number(fd.get("bank_account_id")),
    payment_date: String(fd.get("payment_date") || ""),
    description: String(fd.get("description") || "").trim() || null,
    link_type: linkType,
    sales_invoice_id: fd.get("sales_invoice_id") ? Number(fd.get("sales_invoice_id")) : null,
    purchase_invoice_id: fd.get("purchase_invoice_id") ? Number(fd.get("purchase_invoice_id")) : null,
    account_no: fd.get("account_no") ? Number(fd.get("account_no")) : null,
    employee_id: fd.get("employee_id") ? Number(fd.get("employee_id")) : null,
    vat_perc: fd.get("vat_perc") ? Number(fd.get("vat_perc")) : null,
    in_amount: Number(fd.get("in_amount") || 0),
    in_vat: Number(fd.get("in_vat") || 0),
    out_amount: Number(fd.get("out_amount") || 0),
    out_vat: Number(fd.get("out_vat") || 0),
  };
}

function validate(input: BankTransactionInput): string | undefined {
  if (!input.payment_date) return "Date is required.";
  if (input.in_amount === 0 && input.out_amount === 0) return "Enter an in or out amount.";
  if (input.link_type === "sales" && !input.sales_invoice_id) return "Select a sales invoice.";
  if (input.link_type === "purchase" && !input.purchase_invoice_id) return "Select a purchase invoice.";
  if (input.link_type === "account" && !input.account_no) return "Select an account.";
}

export async function createBankTransactionFormAction(
  _prev: { error?: string; success?: boolean } | undefined,
  fd: FormData
) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    await createBankTransaction(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the transaction." };
  }
  return { success: true };
}

export async function updateBankTransactionFormAction(
  id: number,
  bankAccountKey: string,
  _prev: { error?: string } | undefined,
  fd: FormData
) {
  const input = toInput(fd);
  const error = validate(input);
  if (error) return { error };
  try {
    await updateBankTransaction(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the transaction." };
  }
  redirect(`/banking?account=${bankAccountKey}`);
}

export async function deleteBankTransactionAction(id: number, bankAccountKey: string) {
  await deleteBankTransaction(id);
  revalidatePath(`/banking?account=${bankAccountKey}`);
}

export async function transferFormAction(_prev: { error?: string; success?: boolean } | undefined, fd: FormData) {
  try {
    await createTransfer({
      from_bank_account_id: Number(fd.get("from_bank_account_id")),
      to_bank_account_id: Number(fd.get("to_bank_account_id")),
      date: String(fd.get("date") || ""),
      amount: Number(fd.get("amount") || 0),
      description: String(fd.get("description") || "").trim() || null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the transfer." };
  }
  return { success: true };
}

export async function reconcileThroughFormAction(bankAccountId: number, _prev: { error?: string; success?: boolean; count?: number } | undefined, fd: FormData) {
  const through = String(fd.get("through") || "");
  if (!through) return { error: "Choose the statement date." };
  try {
    const count = await reconcileBankAccountThrough(bankAccountId, through);
    return { success: true, count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reconcile." };
  }
}
