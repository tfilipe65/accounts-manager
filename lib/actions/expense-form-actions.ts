"use server";

import { redirect } from "next/navigation";
import { createPurchaseInvoice, updatePurchaseInvoice, deletePurchaseInvoice, type PurchaseInvoiceInput } from "@/lib/actions/expense-actions";

function toInput(fd: FormData): PurchaseInvoiceInput {
  const linesJson = String(fd.get("lines_json") || "[]");
  return {
    invoice_number: String(fd.get("invoice_number") || "").trim(),
    date: String(fd.get("date") || ""),
    supplier_id: Number(fd.get("supplier_id")),
    doc_type: String(fd.get("doc_type") || "Invoice"),
    credit_for_invoice_id: Number(fd.get("credit_for_invoice_id")) || null,
    lines: JSON.parse(linesJson),
  };
}

export async function createExpenseFormAction(_prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.invoice_number) return { error: "Invoice number is required." };
  if (!input.supplier_id) return { error: "Select a supplier." };
  if (!input.date) return { error: "Date is required." };
  try {
    await createPurchaseInvoice(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the invoice." };
  }
  redirect("/expense");
}

export async function updateExpenseFormAction(id: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.invoice_number) return { error: "Invoice number is required." };
  if (!input.supplier_id) return { error: "Select a supplier." };
  if (!input.date) return { error: "Date is required." };
  try {
    await updatePurchaseInvoice(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the invoice." };
  }
  redirect("/expense");
}

export async function deleteExpenseAction(id: number) {
  await deletePurchaseInvoice(id);
}
