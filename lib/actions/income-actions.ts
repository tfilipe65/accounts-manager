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
import { assertLineAccounts } from "@/lib/account-rules";
import { owedLabel } from "@/lib/invoice-labels";

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
  /** For a credit note: the invoice it is applied to (counts as a payment on it). */
  credit_for_invoice_id?: number | null;
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
  SELECT si.id, si.invoice_number, si.date, si.doc_type, si.customer_id, c.name AS customer_name,
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
    SELECT sales_invoice_id, SUM(amount) AS paid FROM sales_invoice_settlements GROUP BY sales_invoice_id
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
    credit_for_invoice_id: number | null;
  }>("SELECT id, invoice_number, date, doc_type, customer_id, reference, sales_id, credit_for_invoice_id FROM sales_invoices WHERE id = $1", [id]);
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
    credit_for_invoice_id: header.credit_for_invoice_id,
    lines: lineRows.map((l) => ({
      ...l,
      quantity: Number(l.quantity),
      price_ex_vat: Number(l.price_ex_vat),
      vat_perc: Number(l.vat_perc),
      discount_perc: Number(l.discount_perc),
    })),
  };
}

/** Only a credit note can be applied to an invoice. */
function creditFor(input: SalesInvoiceInput): number | null {
  return input.doc_type === "Credit Note" ? (input.credit_for_invoice_id ?? null) : null;
}

/** A credit note applied to an invoice must be for the same client, a negative amount, and no more than is still due. */
async function assertCreditFits(client: Queryable, id: number, input: SalesInvoiceInput): Promise<void> {
  const target = creditFor(input);
  if (target == null) return;
  if (target === id) throw new Error("A credit note cannot be applied to itself.");
  const inv = (
    await client.query<{ doc_type: string; customer_id: number; invoice_number: string }>(
      "SELECT doc_type, customer_id, invoice_number FROM sales_invoices WHERE id = $1",
      [target]
    )
  ).rows[0];
  if (!inv) throw new Error("The invoice this credit note is for no longer exists.");
  if (inv.doc_type === "Credit Note" || inv.doc_type === "Proforma") throw new Error("A credit note can only be applied to an invoice.");
  if (inv.customer_id !== input.customer_id) throw new Error(`The client on the credit note is not the client on invoice ${inv.invoice_number}.`);
  const credit = input.lines.reduce((s, l) => s + l.quantity * l.price_ex_vat * (1 - l.discount_perc) * (1 + l.vat_perc), 0);
  if (credit > -0.005) throw new Error("A credit note applied to an invoice must be for a negative amount (use a negative quantity on its lines).");
  const row = (
    await client.query<{ gross: string; paid: string }>(
      `SELECT COALESCE((SELECT SUM(quantity * price_ex_vat * (1 - discount_perc) * (1 + vat_perc)) FROM sales_invoice_lines WHERE sales_invoice_id = $1), 0) AS gross,
              COALESCE((SELECT SUM(amount) FROM sales_invoice_settlements WHERE sales_invoice_id = $1), 0) AS paid`,
      [target]
    )
  ).rows[0];
  // the settlements already include this credit note, now that it is saved
  const stillDue = Number(row.gross) - Number(row.paid);
  if (stillDue < -0.005) {
    throw new Error(`Invoice ${inv.invoice_number} only has ${(stillDue - credit).toFixed(2)} still due; this credit note is for ${(-credit).toFixed(2)}.`);
  }
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
      `INSERT INTO sales_invoices (invoice_number, date, doc_type, customer_id, reference, sales_id, credit_for_invoice_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [input.invoice_number, input.date, input.doc_type, input.customer_id, input.reference, input.sales_id, creditFor(input)]
    );
    const newId = header.rows[0].id;
    await assertLineAccounts(client, "income", input.lines.map((l) => l.account_no));
    await insertLines(client, newId, input.lines);
    await assertCreditFits(client, newId, input);
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
      `UPDATE sales_invoices SET invoice_number = $2, date = $3, doc_type = $4, customer_id = $5, reference = $6, sales_id = $7, credit_for_invoice_id = $8, updated_at = now()
       WHERE id = $1`,
      [id, input.invoice_number, input.date, input.doc_type, input.customer_id, input.reference, input.sales_id, creditFor(input)]
    );
    const carried = (await client.query<{ account_no: number }>("SELECT account_no FROM sales_invoice_lines WHERE sales_invoice_id = $1", [id])).rows.map((r) => r.account_no);
    await assertLineAccounts(client, "income", input.lines.map((l) => l.account_no), carried);
    await client.query("DELETE FROM sales_invoice_lines WHERE sales_invoice_id = $1", [id]);
    await insertLines(client, id, input.lines);
    await assertCreditFits(client, id, input);
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

/**
 * Invoices a credit note can be applied to: those with something still due (labelled with the amount).
 * `keepId` is the invoice an existing credit note is already applied to.
 */
export async function listInvoicesForCredit(keepId?: number | null): Promise<{ id: number; label: string; customer_id: number }[]> {
  await requireSession();
  const rows = await query<ListRow & { customer_id: number }>(
    `${LIST_SQL} WHERE si.doc_type NOT IN ('Proforma', 'Credit Note') AND (si.id = $1 OR COALESCE(lt.gross, 0) - COALESCE(pt.paid, 0) >= 0.005)
     ORDER BY si.date DESC, si.invoice_number DESC`,
    [keepId ?? null]
  );
  return rows.map((r) => ({
    id: r.id,
    customer_id: r.customer_id,
    label: owedLabel(`${r.invoice_number} (${r.date.slice(0, 10)})`, Number(r.gross), Number(r.paid)),
  }));
}
