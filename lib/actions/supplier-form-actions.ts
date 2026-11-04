"use server";

import { redirect } from "next/navigation";
import { createSupplier, updateSupplier, deleteSupplier, type SupplierInput } from "@/lib/actions/supplier-actions";

function str(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) || "").trim();
  return v || null;
}

function toInput(fd: FormData): SupplierInput {
  const intra = str(fd, "intra_community");
  return {
    name: String(fd.get("name") || "").trim(),
    address: str(fd, "address"),
    zip: str(fd, "zip"),
    city: str(fd, "city"),
    country: str(fd, "country"),
    contact: str(fd, "contact"),
    payment_term_days: fd.get("payment_term_days") ? Number(fd.get("payment_term_days")) : null,
    telephone: str(fd, "telephone"),
    email: str(fd, "email"),
    vat_number: str(fd, "vat_number"),
    coc_number: str(fd, "coc_number"),
    intra_community: intra === "EU" || intra === "NON-EU" ? intra : null,
    free_code_1: str(fd, "free_code_1"),
    free_code_2: str(fd, "free_code_2"),
  };
}

export async function createSupplierFormAction(_prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.name) return { error: "Name is required." };
  try {
    await createSupplier(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the supplier." };
  }
  redirect("/suppliers");
}

export async function updateSupplierFormAction(id: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.name) return { error: "Name is required." };
  try {
    await updateSupplier(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the supplier." };
  }
  redirect("/suppliers");
}

export async function deleteSupplierAction(id: number) {
  await deleteSupplier(id);
}
