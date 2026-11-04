"use server";

// VAT (Portuguese IVA) report -- the workbook's Tax_Report/IVA_Summary
// sheets. Output VAT (charged on sales) minus Input VAT (paid on purchases)
// = net VAT payable to (positive) or refundable from (negative) the tax
// authority, broken down by quarter.
//
// Quarter is derived straight from the calendar month (CEIL(month/3.0)).
// This assumes a January-start fiscal year, which matches this company's
// app_settings.fiscal_year_start_month = 1 -- if that's ever changed to a
// non-calendar fiscal year, this needs the same fiscal-month shift the
// workbook applies (FY_START_MONTH-relative), not just EXTRACT(MONTH).
//
// Also includes VAT on DIRECT Banking entries (account_no IS NOT NULL, e.g. a
// bank fee with VAT, or misc income received straight into the bank with no
// invoice raised) -- bank_transactions carries its own vat_perc/in_vat/out_vat
// for exactly this case. An invoice-LINKED transaction's in_vat/out_vat is
// deliberately excluded here: that VAT was already recognised at the invoice's
// own date via sales_invoice_lines/purchase_invoice_lines above, and this
// report is invoice-date-based (not payment-date-based) -- counting it again
// at payment date would double the figure.

import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type VatQuarterRow = {
  year: number;
  quarter: number;
  outputVat: number;
  inputVat: number;
  netVat: number;
};

/** @param year Restrict to just this year's quarters; omit (or undefined) for every year ever. */
export async function getVatReport(year?: number): Promise<{ rows: VatQuarterRow[]; totalOutput: number; totalInput: number; totalNet: number }> {
  await requireSession();
  const yearFilter = year ?? null;

  const outputRows = await query<{ year: number; quarter: number; vat: string }>(
    `
    SELECT year, quarter, SUM(vat) AS vat FROM (
      SELECT EXTRACT(YEAR FROM si.date)::int AS year, CEIL(EXTRACT(MONTH FROM si.date) / 3.0)::int AS quarter,
             sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc) * sil.vat_perc AS vat
      FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      UNION ALL
      SELECT EXTRACT(YEAR FROM payment_date)::int AS year, CEIL(EXTRACT(MONTH FROM payment_date) / 3.0)::int AS quarter, in_vat AS vat
      FROM bank_transactions WHERE account_no IS NOT NULL AND in_vat <> 0
    ) x WHERE $1::int IS NULL OR year = $1::int GROUP BY 1, 2
  `,
    [yearFilter]
  );
  const inputRows = await query<{ year: number; quarter: number; vat: string }>(
    `
    SELECT year, quarter, SUM(vat) AS vat FROM (
      SELECT EXTRACT(YEAR FROM pi.date)::int AS year, CEIL(EXTRACT(MONTH FROM pi.date) / 3.0)::int AS quarter,
             pil.amount_inc_vat - pil.amount_inc_vat / (1 + pil.vat_perc) AS vat
      FROM purchase_invoice_lines pil JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
      UNION ALL
      SELECT EXTRACT(YEAR FROM payment_date)::int AS year, CEIL(EXTRACT(MONTH FROM payment_date) / 3.0)::int AS quarter, out_vat AS vat
      FROM bank_transactions WHERE account_no IS NOT NULL AND out_vat <> 0
    ) x WHERE $1::int IS NULL OR year = $1::int GROUP BY 1, 2
  `,
    [yearFilter]
  );

  const byPeriod = new Map<string, VatQuarterRow>();
  const keyOf = (y: number, q: number) => `${y}-${q}`;
  for (const r of outputRows) {
    const key = keyOf(r.year, r.quarter);
    byPeriod.set(key, { year: r.year, quarter: r.quarter, outputVat: Number(r.vat), inputVat: 0, netVat: 0 });
  }
  for (const r of inputRows) {
    const key = keyOf(r.year, r.quarter);
    const existing = byPeriod.get(key);
    if (existing) existing.inputVat = Number(r.vat);
    else byPeriod.set(key, { year: r.year, quarter: r.quarter, outputVat: 0, inputVat: Number(r.vat), netVat: 0 });
  }

  let totalOutput = 0;
  let totalInput = 0;
  const rows = Array.from(byPeriod.values())
    .map((r) => ({ ...r, netVat: r.outputVat - r.inputVat }))
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter);
  for (const r of rows) {
    totalOutput += r.outputVat;
    totalInput += r.inputVat;
  }

  return { rows, totalOutput, totalInput, totalNet: totalOutput - totalInput };
}
