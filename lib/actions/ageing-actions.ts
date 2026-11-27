"use server";

// Ageing analysis -- the workbook's Income_Monitor/Expense_Monitor sheets.
// Due date = invoice date + the customer/supplier's payment term (days);
// bucketed against app_settings' age_analysis_1/2/3_days (30/60/90 by
// default). Only invoices with outstanding > 0 show up here -- a fully paid
// invoice isn't "aged", it's done.
//
// Deliberately excludes opening_balances: the AR/AP opening balance (a lump
// sum carried in from before this system went live -- see [[project-accounts-manager]])
// has no individual invoice or due date to age against, so it can't
// meaningfully appear in a per-invoice ageing table. It DOES still show up
// correctly in the Trial Balance's AR/AP totals -- this is the one place
// those two reports intentionally disagree, not a bug.

import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type AgeingRow = {
  id: number;
  invoice_number: string;
  party_name: string;
  date: string;
  due_date: string;
  outstanding: number;
  days_overdue: number;
  bucket: string;
};

async function getBucketDays() {
  const s = await queryOne<{ age_analysis_1_days: number; age_analysis_2_days: number; age_analysis_3_days: number }>(
    "SELECT age_analysis_1_days, age_analysis_2_days, age_analysis_3_days FROM app_settings WHERE id = 1"
  );
  return { d1: s?.age_analysis_1_days ?? 30, d2: s?.age_analysis_2_days ?? 60, d3: s?.age_analysis_3_days ?? 90 };
}

function bucketFor(daysOverdue: number, d1: number, d2: number, d3: number): string {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= d1) return `1-${d1} days`;
  if (daysOverdue <= d2) return `${d1 + 1}-${d2} days`;
  if (daysOverdue <= d3) return `${d2 + 1}-${d3} days`;
  return `${d3}+ days`;
}

/** Fixed bucket order for chart display -- bucketFor() above always produces one of these five labels. */
function bucketOrder(d1: number, d2: number, d3: number): string[] {
  return ["Current", `1-${d1} days`, `${d1 + 1}-${d2} days`, `${d2 + 1}-${d3} days`, `${d3}+ days`];
}

/** Total outstanding per ageing bucket, in fixed chart order (zero-filled). */
export async function getAgeingBucketTotals(rows: AgeingRow[]): Promise<{ bucket: string; amount: number }[]> {
  const { d1, d2, d3 } = await getBucketDays();
  const totals = new Map<string, number>();
  for (const b of bucketOrder(d1, d2, d3)) totals.set(b, 0);
  for (const r of rows) totals.set(r.bucket, (totals.get(r.bucket) ?? 0) + r.outstanding);
  return Array.from(totals.entries()).map(([bucket, amount]) => ({ bucket, amount }));
}

/**
 * @param asOfDate Point-in-time cutoff ("YYYY-MM-DD") -- when set, only
 * invoices/payments dated on or before this are considered, and it's also
 * used as "today" for the days-overdue calculation (so picking a past year
 * shows ageing as it stood at that year's end, not aged against today's
 * actual date). `undefined` means no cutoff -- as of right now.
 */
export async function getReceivablesAgeing(asOfDate?: string): Promise<{ rows: AgeingRow[]; totalOutstanding: number }> {
  await requireSession();
  const { d1, d2, d3 } = await getBucketDays();
  const cutoff = asOfDate ?? null;

  const rows = await query<{
    id: number;
    invoice_number: string;
    party_name: string;
    date: string;
    payment_term_days: number | null;
    gross: string;
    paid: string;
  }>(
    `
    SELECT si.id, si.invoice_number, c.name AS party_name, si.date,
           COALESCE(c.payment_term_days, (SELECT payment_term_days FROM app_settings WHERE id = 1)) AS payment_term_days,
           COALESCE(lt.gross, 0) AS gross, COALESCE(pt.paid, 0) AS paid
    FROM sales_invoices si
    JOIN customers c ON c.id = si.customer_id
    LEFT JOIN (
      SELECT sales_invoice_id, SUM(quantity * price_ex_vat * (1 - discount_perc) * (1 + vat_perc)) AS gross
      FROM sales_invoice_lines GROUP BY sales_invoice_id
    ) lt ON lt.sales_invoice_id = si.id
    LEFT JOIN (
      SELECT sales_invoice_id, SUM(amount) AS paid
      FROM sales_invoice_settlements WHERE ($1::date IS NULL OR settled_on <= $1::date) GROUP BY sales_invoice_id
    ) pt ON pt.sales_invoice_id = si.id
    WHERE si.doc_type <> 'Proforma' AND ($1::date IS NULL OR si.date <= $1::date)
  `,
    [cutoff]
  );

  return buildAgeing(rows, d1, d2, d3, cutoff);
}

export async function getPayablesAgeing(asOfDate?: string): Promise<{ rows: AgeingRow[]; totalOutstanding: number }> {
  await requireSession();
  const { d1, d2, d3 } = await getBucketDays();
  const cutoff = asOfDate ?? null;

  const rows = await query<{
    id: number;
    invoice_number: string;
    party_name: string;
    date: string;
    payment_term_days: number | null;
    gross: string;
    paid: string;
  }>(
    `
    SELECT pi.id, pi.invoice_number, s.name AS party_name, pi.date,
           COALESCE(s.payment_term_days, (SELECT payment_term_days FROM app_settings WHERE id = 1)) AS payment_term_days,
           COALESCE(lt.gross, 0) AS gross, COALESCE(pt.paid, 0) AS paid
    FROM purchase_invoices pi
    JOIN suppliers s ON s.id = pi.supplier_id
    LEFT JOIN (
      SELECT purchase_invoice_id, SUM(amount_inc_vat) AS gross
      FROM purchase_invoice_lines GROUP BY purchase_invoice_id
    ) lt ON lt.purchase_invoice_id = pi.id
    LEFT JOIN (
      SELECT purchase_invoice_id, SUM(amount) AS paid
      FROM purchase_invoice_settlements WHERE ($1::date IS NULL OR settled_on <= $1::date) GROUP BY purchase_invoice_id
    ) pt ON pt.purchase_invoice_id = pi.id
    WHERE $1::date IS NULL OR pi.date <= $1::date
  `,
    [cutoff]
  );

  return buildAgeing(rows, d1, d2, d3, cutoff);
}

function buildAgeing(
  rows: { id: number; invoice_number: string; party_name: string; date: string; payment_term_days: number | null; gross: string; paid: string }[],
  d1: number,
  d2: number,
  d3: number,
  cutoff: string | null
): { rows: AgeingRow[]; totalOutstanding: number } {
  // cutoff is already a plain YYYY-MM-DD parsed at UTC midnight -- don't
  // re-normalize it with setHours(), which operates in local time and would
  // shift the instant for any timezone behind UTC (the exact bug class
  // lib/db.ts's DATE type-parser exists to avoid elsewhere in this app).
  const today = new Date();
  if (cutoff) today.setTime(Date.parse(cutoff + "T00:00:00Z"));
  else today.setHours(0, 0, 0, 0);
  let totalOutstanding = 0;
  const result: AgeingRow[] = [];

  for (const r of rows) {
    const outstanding = Number(r.gross) - Number(r.paid);
    if (outstanding < 0.005) continue;

    const invoiceDate = new Date(r.date + "T00:00:00Z");
    const dueDate = new Date(invoiceDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + (r.payment_term_days ?? 0));
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);

    totalOutstanding += outstanding;
    result.push({
      id: r.id,
      invoice_number: r.invoice_number,
      party_name: r.party_name,
      date: r.date,
      due_date: dueDate.toISOString().slice(0, 10),
      outstanding,
      days_overdue: daysOverdue,
      bucket: bucketFor(daysOverdue, d1, d2, d3),
    });
  }

  result.sort((a, b) => b.days_overdue - a.days_overdue);
  return { rows: result, totalOutstanding };
}
