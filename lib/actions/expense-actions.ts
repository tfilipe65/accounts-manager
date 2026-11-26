"use server";

// Purchase invoices (the workbook's Expense sheet). Simpler than Income --
// no per-line product/qty breakdown there, just a direct gross amount per
// line (Amount Inc. IVA) with IVA and Amount exc. IVA derived from it and
// the line's own VAT%.

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";
import type { Queryable } from "@/lib/db";
import { assertLineAccounts } from "@/lib/account-rules";

export type PurchaseInvoiceLineInput = {
  description: string | null;
  account_no: number;
  project_id: number | null;
  vat_perc: number;
  amount_inc_vat: number;
  remarks: string | null;
  free_code_1: string | null;
  free_code_2: string | null;
};

export type PurchaseInvoiceInput = {
  invoice_number: string;
  date: string;
  supplier_id: number;
  lines: PurchaseInvoiceLineInput[];
};

export type PurchaseInvoiceListItem = {
  id: number;
  invoice_number: string;
  date: string;
  supplier_name: string;
  gross: number;
  vat: number;
  net: number;
  paid: number;
  outstanding: number;
};

// Same fan-out-avoidance shape as income-actions.ts's LIST_SQL: lines and
// bank-transaction payments are both one-to-many against an invoice, each
// aggregated in its own subquery.
const LIST_SQL = `
  SELECT pi.id, pi.invoice_number, pi.date, s.name AS supplier_name,
         COALESCE(lt.gross, 0) AS gross,
         COALESCE(lt.vat, 0) AS vat,
         COALESCE(lt.gross, 0) - COALESCE(lt.vat, 0) AS net,
         COALESCE(pt.paid, 0) AS paid
  FROM purchase_invoices pi
  JOIN suppliers s ON s.id = pi.supplier_id
  LEFT JOIN (
    SELECT purchase_invoice_id,
           SUM(amount_inc_vat) AS gross,
           SUM(amount_inc_vat - amount_inc_vat / (1 + vat_perc)) AS vat
    FROM purchase_invoice_lines GROUP BY purchase_invoice_id
  ) lt ON lt.purchase_invoice_id = pi.id
  LEFT JOIN (
    SELECT purchase_invoice_id, SUM(out_amount + out_vat) AS paid
    FROM bank_transactions WHERE purchase_invoice_id IS NOT NULL GROUP BY purchase_invoice_id
  ) pt ON pt.purchase_invoice_id = pi.id
`;

type ListRow = Omit<PurchaseInvoiceListItem, "gross" | "vat" | "net" | "paid" | "outstanding"> & {
  gross: string;
  vat: string;
  net: string;
  paid: string;
};

function normalizeListRow(r: ListRow): PurchaseInvoiceListItem {
  const gross = Number(r.gross);
  const vat = Number(r.vat);
  const net = Number(r.net);
  const paid = Number(r.paid);
  return { ...r, gross, vat, net, paid, outstanding: gross - paid };
}

/** @param year Restrict to invoices dated in this year; omit for every year ever. */
export async function listPurchaseInvoices(year?: number): Promise<PurchaseInvoiceListItem[]> {
  await requireSession();
  const yearFilter = year ?? null;
  const rows = await query<ListRow>(
    `${LIST_SQL} WHERE $1::int IS NULL OR EXTRACT(YEAR FROM pi.date) = $1::int ORDER BY pi.date DESC, pi.invoice_number DESC`,
    [yearFilter]
  );
  return rows.map(normalizeListRow);
}

export type PurchaseInvoiceDetail = PurchaseInvoiceInput & { id: number };

export async function getPurchaseInvoiceForEdit(id: number): Promise<PurchaseInvoiceDetail | null> {
  await requireSession();
  const header = await queryOne<{ id: number; invoice_number: string; date: string; supplier_id: number }>(
    "SELECT id, invoice_number, date, supplier_id FROM purchase_invoices WHERE id = $1",
    [id]
  );
  if (!header) return null;

  const lineRows = await query<{
    description: string | null;
    account_no: number;
    project_id: number | null;
    vat_perc: string;
    amount_inc_vat: string;
    remarks: string | null;
    free_code_1: string | null;
    free_code_2: string | null;
  }>(
    "SELECT description, account_no, project_id, vat_perc, amount_inc_vat, remarks, free_code_1, free_code_2 FROM purchase_invoice_lines WHERE purchase_invoice_id = $1 ORDER BY line_no",
    [id]
  );

  return {
    id: header.id,
    invoice_number: header.invoice_number,
    date: header.date,
    supplier_id: header.supplier_id,
    lines: lineRows.map((l) => ({ ...l, vat_perc: Number(l.vat_perc), amount_inc_vat: Number(l.amount_inc_vat) })),
  };
}

async function insertLines(client: Queryable, purchaseInvoiceId: number, lines: PurchaseInvoiceLineInput[]): Promise<void> {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await client.query(
      `INSERT INTO purchase_invoice_lines
        (purchase_invoice_id, line_no, description, account_no, project_id, vat_perc, amount_inc_vat, remarks, free_code_1, free_code_2)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [purchaseInvoiceId, i + 1, l.description, l.account_no, l.project_id, l.vat_perc, l.amount_inc_vat, l.remarks, l.free_code_1, l.free_code_2]
    );
  }
}

export async function createPurchaseInvoice(input: PurchaseInvoiceInput): Promise<number> {
  const session = await requireSession();
  if (input.lines.length === 0) throw new Error("An invoice needs at least one line.");
  await assertYearOpen(input.date, session);
  const id = await withTransaction(async (client) => {
    const header = await client.query<{ id: number }>(
      `INSERT INTO purchase_invoices (invoice_number, date, supplier_id) VALUES ($1,$2,$3) RETURNING id`,
      [input.invoice_number, input.date, input.supplier_id]
    );
    const newId = header.rows[0].id;
    await assertLineAccounts(client, "expense", input.lines.map((l) => l.account_no));
    await insertLines(client, newId, input.lines);
    return newId;
  });
  revalidatePath("/expense");
  return id;
}

export async function updatePurchaseInvoice(id: number, input: PurchaseInvoiceInput): Promise<void> {
  const session = await requireSession();
  if (input.lines.length === 0) throw new Error("An invoice needs at least one line.");
  const existing = await queryOne<{ date: string }>("SELECT date FROM purchase_invoices WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.date, session);
  await assertYearOpen(input.date, session);
  await withTransaction(async (client) => {
    await client.query(`UPDATE purchase_invoices SET invoice_number = $2, date = $3, supplier_id = $4, updated_at = now() WHERE id = $1`, [
      id,
      input.invoice_number,
      input.date,
      input.supplier_id,
    ]);
    const carried = (await client.query<{ account_no: number }>("SELECT account_no FROM purchase_invoice_lines WHERE purchase_invoice_id = $1", [id])).rows.map((r) => r.account_no);
    await assertLineAccounts(client, "expense", input.lines.map((l) => l.account_no), carried);
    await client.query("DELETE FROM purchase_invoice_lines WHERE purchase_invoice_id = $1", [id]);
    await insertLines(client, id, input.lines);
  });
  revalidatePath("/expense");
  revalidatePath(`/expense/${id}`);
}

export async function deletePurchaseInvoice(id: number): Promise<void> {
  const session = await requireSession();
  const existing = await queryOne<{ date: string }>("SELECT date FROM purchase_invoices WHERE id = $1", [id]);
  if (existing) await assertYearOpen(existing.date, session);
  await query("DELETE FROM purchase_invoices WHERE id = $1", [id]);
  revalidatePath("/expense");
}
