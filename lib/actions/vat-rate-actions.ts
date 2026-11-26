"use server";

import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";

/** The VAT rates this company uses (Settings), as fractions: 0.23 means 23%. Offered in every VAT % dropdown. */
export async function getVatRates(): Promise<number[]> {
  await requireSession();
  const rows = await query<{ vat_rate_1: string | null; vat_rate_2: string | null; vat_rate_3: string | null; vat_rate_4: string | null }>(
    "SELECT vat_rate_1, vat_rate_2, vat_rate_3, vat_rate_4 FROM app_settings WHERE id = 1"
  );
  const r = rows[0];
  if (!r) return [];
  return [r.vat_rate_1, r.vat_rate_2, r.vat_rate_3, r.vat_rate_4].filter((v) => v != null).map(Number);
}
