"use server";

import { redirect } from "next/navigation";
import { createSalesInvoice, updateSalesInvoice, deleteSalesInvoice, type SalesInvoiceInput } from "@/lib/actions/income-actions";

function toInput(fd: FormData): SalesInvoiceInput {
  const linesJson = String(fd.get("lines_json") || "[]");
  return {
    invoice_number: String(fd.get("invoice_number") || "").trim(),
    date: String(fd.get("date") || ""),
    doc_type: String(fd.get("doc_type") || "Invoice"),
    customer_id: Number(fd.get("customer_id")),
    reference: String(fd.get("reference") || "").trim() || null,
    sales_id: String(fd.get("sales_id") || "").trim() || null,
    credit_for_invoice_id: Number(fd.get("credit_for_invoice_id")) || null,
    lines: JSON.parse(linesJson),
  };
}

export async function createIncomeFormAction(_prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.invoice_number) return { error: "Invoice number is required." };
  if (!input.customer_id) return { error: "Select a client." };
  if (!input.date) return { error: "Date is required." };
  try {
    await createSalesInvoice(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the invoice." };
  }
  redirect("/income");
}

export async function updateIncomeFormAction(id: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.invoice_number) return { error: "Invoice number is required." };
  if (!input.customer_id) return { error: "Select a client." };
  if (!input.date) return { error: "Date is required." };
  try {
    await updateSalesInvoice(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the invoice." };
  }
  redirect("/income");
}

export async function deleteIncomeAction(id: number) {
  await deleteSalesInvoice(id);
}
