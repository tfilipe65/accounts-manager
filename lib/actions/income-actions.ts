"use server";

// Sales invoices (the workbook's Income sheet). One header row per invoice
// number, N line rows underneath -- ported as sales_invoices +
// sales_invoice_lines rather than the sheet's single flat table, but the
// fields are exactly the sheet's manual-entry columns (D,G,H,L,M,Q,R,S,T,U,
// W,X,Z,AA); everything else on that sheet (Paid, Outstanding, Gross/Net/VAT,
// Year/Quarter/Month, ...) is a formula there and a computed value here, not
// a stored column.

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";
import type { Queryable } from "@/lib/db";

export type SalesInvoiceLineInput = {
  product_service_id: number | null;
  subject: string | null;
  quantity: number;
  price_ex_vat: number;
  vat_perc: number;
  discount_perc: number;
  account_no: number;
  project_id: number | null;
  free_code: string | null;
};

export type SalesInvoiceInput = {
  invoice_number: string;
  date: string;
  doc_type: string;
  customer_id: number;
  reference: string | null;
  sales_id: string | null;
  lines: SalesInvoiceLineInput[];
};

export type SalesInvoiceListItem = {
  id: number;
  invoice_number: string;
  date: string;
  doc_type: string;
  customer_name: string;
  net: number;
  vat: number;
  gross: number;
  paid: number;
  outstanding: number;
};

// Lines and bank-transaction payments are both one-to-many against an
// invoice -- aggregating each in its own subquery avoids a join fan-out that
// would otherwise multiply (and silently inflate) the SUMs.
const LIST_SQL = `
  SELECT si.id, si.invoice_number, si.date, si.doc_type, c.name AS customer_name,
         COALESCE(lt.net, 0) AS net, COALESCE(lt.vat, 0) AS vat, COALESCE(lt.gross, 0) AS gross,
         COALESCE(pt.paid, 0) AS paid
  FROM sales_invoices si
  JOIN customers c ON c.id = si.customer_id
  LEFT JOIN (
    SELECT sales_invoice_id,
           SUM(quantity * price_ex_vat * (1 - discount_perc)) AS net,
           SUM(quantity * price_ex_vat * (1 - discount_perc) * vat_perc) AS vat,
           SUM(quantity * price_ex_vat * (1 - discount_perc) * (1 + vat_perc)) AS gross
    FROM sales_invoice_lines GROUP BY sales_invoice_id
  ) lt ON lt.sales_invoice_id = si.id
  LEFT JOIN (
    SELECT sales_invoice_id, SUM(in_amount + in_vat) AS paid
    FROM bank_transactions WHERE sales_invoice_id IS NOT NULL GROUP BY sales_invoice_id
  ) pt ON pt.sales_invoice_id = si.id
`;

type ListRow = Omit<SalesInvoiceListItem, "net" | "vat" | "gross" | "paid" | "outstanding"> & {
  net: string;
  vat: string;
  gross: string;
  paid: string;
};

function normalizeListRow(r: ListRow): SalesInvoiceListItem {
  const net = Number(r.net);
  const vat = Number(r.vat);
  const gross = Number(r.gross);
  const paid = Number(r.paid);
  return { ...r, net, vat, gross, paid, outstanding: gross - paid };
}

/** @param year Restrict to invoices dated in this year; omit for every year ever. */
export async function listSalesInvoices(year?: number): Promise<SalesInvoiceListItem[]> {
  await requireSession();
  const yearFilter = year ?? null;
  const rows = await query<ListRow>(
    `${LIST_SQL} WHERE $1::int IS NULL OR EXTRACT(YEAR FROM si.date) = $1::int ORDER BY si.date DESC, si.invoice_number DESC`,
    [yearFilter]
  );
  return rows.map(normalizeListRow);
}

export type SalesInvoiceDetail = SalesInvoiceInput & { id: number };

export async function getSalesInvoiceForEdit(id: number): Promise<SalesInvoiceDetail | null> {
  await requireSession();
  const header = await queryOne<{
    id: number;
    invoice_number: string;
    date: string;
    doc_type: string;
    customer_id: number;
    reference: string | null;
    sales_id: string | null;
  }>("SELECT id, invoice_number, date, doc_type, customer_id, reference, sales_id FROM sales_invoices WHERE id = $1", [id]);
  if (!header) return null;

  const lineRows = await query<{
    product_service_id: number | null;
    subject: string | null;
    quantity: string;
    price_ex_vat: string;
    vat_perc: string;
    discount_perc: string;
    account_no: number;
    project_id: number | null;
    free_code: string | null;
  }>(
    "SELECT product_service_id, subject, quantity, price_ex_vat, vat_perc, discount_perc, account_no, project_id, free_code FROM sales_invoice_lines WHERE sales_invoice_id = $1 ORDER BY line_no",
    [id]
  );

  return {
    id: header.id,
    invoice_number: header.invoice_number,
    date: header.date,
    doc_type: header.doc_type,
    customer_id: header.customer_id,
    reference: header.reference,
    sales_id: header.sales_id,
    lines: lineRows.map((l) => ({
      ...l,
      quantity: Number(l.quantity),
      price_ex_vat: Number(l.price_ex_vat),
      vat_perc: Number(l.vat_perc),
      discount_perc: Number(l.discount_perc),
    })),
  };
}

async function insertLines(client: Queryable, salesInvoiceId: number, lines: SalesInvoiceLineInput[]): Promise<void> {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await client.query(
      `INSERT INTO sales_invoice_lines
        (sales_invoice_id, line_no, product_service_id, subject, quantity, price_ex_vat, vat_perc, discount_perc, account_no, project_id, free_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        salesInvoiceId,
        i + 1,
        l.product_service_id,
        l.subject,
        l.quantity,
        l.price_ex_vat,
        l.vat_perc,
        l.discount_perc,
        l.account_no,
        l.project_id,
        l.free_code,
      ]
    );
  }
}

export async function createSalesInvoice(input: SalesInvoiceInput): Promise<number> {
  const session = await requireSession();
  if (input.lines.length === 0) throw new Error("An invoice needs at least one line.");
  await assertYearOpen(input.date, session);
  const id = await withTransaction(async (client) => {
    const header = await client.query<{ id: number }>(
      `INSERT INTO sales_invoices (invoice_number, date, doc_type, customer_id, reference, sales_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [input.invoice_number, input.date, input.doc_type, input.customer_id, input.reference, input.sales_id]
    );
    const newId = header.rows[0].id;
    await insertLines(client, newId, input.lines);
    return newId;
  });
  revalidatePath("/income");
  return id;
}

export async function updateSalesInvoice(id: number, input: SalesInvoiceInput): Promise<void> {
  const session = await requireSession();
  if (input.lines.length === 0) throw new Error("An invoice needs at least one line.");
  const existing = await queryOne<{ date: string }>("SELECT date FROM sales_invoices WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.date, session);
  await assertYearOpen(input.date, session);
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE sales_invoices SET invoice_number = $2, date = $3, doc_type = $4, customer_id = $5, reference = $6, sales_id = $7, updated_at = now()
       WHERE id = $1`,
      [id, input.invoice_number, input.date, input.doc_type, input.customer_id, input.reference, input.sales_id]
    );
    await client.query("DELETE FROM sales_invoice_lines WHERE sales_invoice_id = $1", [id]);
    await insertLines(client, id, input.lines);
  });
  revalidatePath("/income");
  revalidatePath(`/income/${id}`);
}

export async function deleteSalesInvoice(id: number): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ date: string }>("SELECT date FROM sales_invoices WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.date, session);
  await query("DELETE FROM sales_invoices WHERE id = $1", [id]);
  revalidatePath("/income");
}
