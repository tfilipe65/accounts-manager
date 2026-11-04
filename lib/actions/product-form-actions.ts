"use server";

import { redirect } from "next/navigation";
import { createProduct, updateProduct, deleteProduct, type ProductInput } from "@/lib/actions/product-actions";

function str(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) || "").trim();
  return v || null;
}

function toInput(fd: FormData): ProductInput {
  return {
    name: String(fd.get("name") || "").trim(),
    unit: str(fd, "unit"),
    price_ex_vat: fd.get("price_ex_vat") ? Number(fd.get("price_ex_vat")) : null,
    vat_perc: fd.get("vat_perc") ? Number(fd.get("vat_perc")) : null,
    free_code_1: str(fd, "free_code_1"),
    free_code_2: str(fd, "free_code_2"),
    free_code_3: str(fd, "free_code_3"),
  };
}

export async function createProductFormAction(_prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.name) return { error: "Name is required." };
  try {
    await createProduct(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the product." };
  }
  redirect("/products-services");
}

export async function updateProductFormAction(id: number, _prev: { error?: string } | undefined, fd: FormData) {
  const input = toInput(fd);
  if (!input.name) return { error: "Name is required." };
  try {
    await updateProduct(id, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the product." };
  }
  redirect("/products-services");
}

export async function deleteProductAction(id: number) {
  await deleteProduct(id);
}
