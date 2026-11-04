"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type ProductInput = {
  name: string;
  unit: string | null;
  price_ex_vat: number | null;
  vat_perc: number | null;
  free_code_1: string | null;
  free_code_2: string | null;
  free_code_3: string | null;
};

export type Product = ProductInput & { id: number };

export async function getProduct(id: number): Promise<Product | null> {
  await requireSession();
  const row = await queryOne<Omit<Product, "price_ex_vat" | "vat_perc"> & { price_ex_vat: string | null; vat_perc: string | null }>(
    "SELECT * FROM products_services WHERE id = $1",
    [id]
  );
  if (!row) return null;
  return { ...row, price_ex_vat: row.price_ex_vat != null ? Number(row.price_ex_vat) : null, vat_perc: row.vat_perc != null ? Number(row.vat_perc) : null };
}

export async function createProduct(input: ProductInput): Promise<number> {
  await requireSession();
  const row = await queryOne<{ id: number }>(
    `INSERT INTO products_services (name, unit, price_ex_vat, vat_perc, free_code_1, free_code_2, free_code_3)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [input.name, input.unit, input.price_ex_vat, input.vat_perc, input.free_code_1, input.free_code_2, input.free_code_3]
  );
  revalidatePath("/products-services");
  return row!.id;
}

export async function updateProduct(id: number, input: ProductInput): Promise<void> {
  await requireSession();
  await query(
    `UPDATE products_services SET name=$2, unit=$3, price_ex_vat=$4, vat_perc=$5, free_code_1=$6, free_code_2=$7, free_code_3=$8 WHERE id=$1`,
    [id, input.name, input.unit, input.price_ex_vat, input.vat_perc, input.free_code_1, input.free_code_2, input.free_code_3]
  );
  revalidatePath("/products-services");
  revalidatePath(`/products-services/${id}`);
}

export async function deleteProduct(id: number): Promise<void> {
  await requireSession();
  await query("DELETE FROM products_services WHERE id = $1", [id]);
  revalidatePath("/products-services");
}
