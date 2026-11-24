"use server";

// Top 10s -- the workbook's Top10s sheet (best customers by sales, worst/best
// suppliers by spend, best-selling products). Net (ex-VAT) amounts, matching
// LIST_CUSTOMERS_SALES / LIST_SUPPLIERS_EXPENDITURE / LIST_PRODSERV_REVENUE_TOTAL.

import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type Top10Row = { name: string; amount: number };

export async function getTopCustomers(): Promise<Top10Row[]> {
  await requireSession();
  return (
    await query<{ name: string; amount: string }>(`
    SELECT c.name, SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc)) AS amount
    FROM sales_invoice_lines sil
    JOIN sales_invoices si ON si.id = sil.sales_invoice_id
    JOIN customers c ON c.id = si.customer_id
    WHERE si.doc_type <> 'Proforma'
    GROUP BY c.name ORDER BY amount DESC LIMIT 10
  `)
  ).map((r) => ({ name: r.name, amount: Number(r.amount) }));
}

export async function getTopSuppliers(): Promise<Top10Row[]> {
  await requireSession();
  return (
    await query<{ name: string; amount: string }>(`
    SELECT s.name, SUM(pil.amount_inc_vat / (1 + pil.vat_perc)) AS amount
    FROM purchase_invoice_lines pil
    JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
    JOIN suppliers s ON s.id = pi.supplier_id
    GROUP BY s.name ORDER BY amount DESC LIMIT 10
  `)
  ).map((r) => ({ name: r.name, amount: Number(r.amount) }));
}

export async function getTopProducts(): Promise<Top10Row[]> {
  await requireSession();
  return (
    await query<{ name: string; amount: string }>(`
    SELECT COALESCE(p.name, sil.subject, '(unnamed)') AS name,
           SUM(sil.quantity * sil.price_ex_vat * (1 - sil.discount_perc)) AS amount
    FROM sales_invoice_lines sil
    JOIN sales_invoices si ON si.id = sil.sales_invoice_id
    LEFT JOIN products_services p ON p.id = sil.product_service_id
    WHERE si.doc_type <> 'Proforma'
    GROUP BY COALESCE(p.name, sil.subject, '(unnamed)') ORDER BY amount DESC LIMIT 10
  `)
  ).map((r) => ({ name: r.name, amount: Number(r.amount) }));
}
