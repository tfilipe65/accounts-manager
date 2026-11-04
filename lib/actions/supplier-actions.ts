"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type SupplierInput = {
  name: string;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  contact: string | null;
  payment_term_days: number | null;
  telephone: string | null;
  email: string | null;
  vat_number: string | null;
  coc_number: string | null;
  intra_community: "EU" | "NON-EU" | null;
  free_code_1: string | null;
  free_code_2: string | null;
};

export type Supplier = SupplierInput & { id: number };

export async function getSupplier(id: number): Promise<Supplier | null> {
  await requireSession();
  return queryOne<Supplier>("SELECT * FROM suppliers WHERE id = $1", [id]);
}

export async function createSupplier(input: SupplierInput): Promise<number> {
  await requireSession();
  const row = await queryOne<{ id: number }>(
    `INSERT INTO suppliers (name, address, zip, city, country, contact, payment_term_days, telephone, email, vat_number, coc_number, intra_community, free_code_1, free_code_2)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      input.name,
      input.address,
      input.zip,
      input.city,
      input.country,
      input.contact,
      input.payment_term_days,
      input.telephone,
      input.email,
      input.vat_number,
      input.coc_number,
      input.intra_community,
      input.free_code_1,
      input.free_code_2,
    ]
  );
  revalidatePath("/suppliers");
  return row!.id;
}

export async function updateSupplier(id: number, input: SupplierInput): Promise<void> {
  await requireSession();
  await query(
    `UPDATE suppliers SET name=$2, address=$3, zip=$4, city=$5, country=$6, contact=$7, payment_term_days=$8,
       telephone=$9, email=$10, vat_number=$11, coc_number=$12, intra_community=$13, free_code_1=$14, free_code_2=$15
     WHERE id=$1`,
    [
      id,
      input.name,
      input.address,
      input.zip,
      input.city,
      input.country,
      input.contact,
      input.payment_term_days,
      input.telephone,
      input.email,
      input.vat_number,
      input.coc_number,
      input.intra_community,
      input.free_code_1,
      input.free_code_2,
    ]
  );
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
}

export async function deleteSupplier(id: number): Promise<void> {
  await requireSession();
  await query("DELETE FROM suppliers WHERE id = $1", [id]);
  revalidatePath("/suppliers");
}
