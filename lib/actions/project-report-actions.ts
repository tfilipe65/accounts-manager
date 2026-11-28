"use server";

// Per-project P&L -- the workbook's Project_Report/Projects sheets
// (LIST_PROJECTS_REVENUE/EXPENDITURE/RESULT). Revenue/expenditure are net
// (ex-VAT), matching those named ranges.

import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type ProjectReportRow = {
  id: number;
  code: string;
  name: string;
  status: string | null;
  revenue: number;
  expenditure: number;
  result: number;
};

export async function getProjectReport(): Promise<ProjectReportRow[]> {
  await requireSession();
  const rows = await query<Omit<ProjectReportRow, "revenue" | "expenditure" | "result"> & { revenue: string; expenditure: string }>(`
    SELECT p.id, p.code, p.name, p.status,
           COALESCE(rev.net, 0) AS revenue,
           COALESCE(exp.net, 0) AS expenditure
    FROM projects p
    LEFT JOIN (
      SELECT project_id, SUM(quantity * price_ex_vat * (1 - discount_perc)) AS net
      FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id = sil.sales_invoice_id
      WHERE sil.project_id IS NOT NULL AND si.doc_type <> 'Proforma' GROUP BY sil.project_id
    ) rev ON rev.project_id = p.id
    LEFT JOIN (
      SELECT project_id, SUM(amount_inc_vat / (1 + vat_perc)) AS net
      FROM purchase_invoice_lines WHERE project_id IS NOT NULL GROUP BY project_id
    ) exp ON exp.project_id = p.id
    ORDER BY p.code
  `);
  return rows.map((r) => {
    const revenue = Number(r.revenue);
    const expenditure = Number(r.expenditure);
    return { ...r, revenue, expenditure, result: revenue - expenditure };
  });
}

export type ProjectDetail = {
  project: { id: number; code: string; name: string; status: string | null; start_date: string | null; end_date: string | null };
  revenue: { id: number; date: string; number: string; docType: string; client: string; subject: string | null; net: number }[];
  costs: { id: number; date: string; number: string; supplier: string; description: string | null; account: string; net: number }[];
  costsByAccount: { account: string; net: number }[];
  totals: { revenue: number; expenditure: number; result: number; marginPercent: number | null; invoiced: number; received: number };
};

/** One project: every invoice line and cost line booked to it, what they add up to, and how much has been collected. */
export async function getProjectDetail(id: number): Promise<ProjectDetail | null> {
  await requireSession();
  const project = (
    await query<{ id: number; code: string; name: string; status: string | null; start_date: string | null; end_date: string | null }>(
      "SELECT id, code, name, status, start_date::text, end_date::text FROM projects WHERE id = $1",
      [id]
    )
  )[0];
  if (!project) return null;

  const rev = await query<{ id: number; date: string; number: string; doc_type: string; client: string; subject: string | null; net: string; gross: string }>(
    `SELECT si.id, si.date::text AS date, si.invoice_number AS number, si.doc_type, c.name AS client, l.subject,
            l.quantity * l.price_ex_vat * (1 - l.discount_perc) AS net,
            l.quantity * l.price_ex_vat * (1 - l.discount_perc) * (1 + l.vat_perc) AS gross
     FROM sales_invoice_lines l JOIN sales_invoices si ON si.id = l.sales_invoice_id JOIN customers c ON c.id = si.customer_id
     WHERE l.project_id = $1 AND si.doc_type <> 'Proforma'
     ORDER BY si.date, si.invoice_number, l.line_no`,
    [id]
  );
  const costs = await query<{ id: number; date: string; number: string; supplier: string; description: string | null; account: string; net: string }>(
    `SELECT pi.id, pi.date::text AS date, pi.invoice_number AS number, s.name AS supplier, l.description,
            l.account_no || ' ' || a.name AS account, l.amount_inc_vat / (1 + l.vat_perc) AS net
     FROM purchase_invoice_lines l JOIN purchase_invoices pi ON pi.id = l.purchase_invoice_id
     JOIN suppliers s ON s.id = pi.supplier_id JOIN accounts a ON a.account_no = l.account_no
     WHERE l.project_id = $1
     ORDER BY pi.date, pi.invoice_number, l.line_no`,
    [id]
  );
  // How much of what was invoiced on this project has been paid: each invoice's payments, shared out by the project's part of its total.
  const paid = await query<{ invoiced: string; received: string }>(
    `SELECT COALESCE(SUM(pl.gross), 0) AS invoiced,
            COALESCE(SUM(CASE WHEN ig.gross <> 0 THEN pl.gross * LEAST(GREATEST(COALESCE(st.paid, 0) / ig.gross, 0), 1) ELSE 0 END), 0) AS received
     FROM (SELECT sales_invoice_id, SUM(quantity * price_ex_vat * (1 - discount_perc) * (1 + vat_perc)) AS gross
           FROM sales_invoice_lines WHERE project_id = $1 GROUP BY sales_invoice_id) pl
     JOIN sales_invoices si ON si.id = pl.sales_invoice_id AND si.doc_type <> 'Proforma'
     JOIN (SELECT sales_invoice_id, SUM(quantity * price_ex_vat * (1 - discount_perc) * (1 + vat_perc)) AS gross FROM sales_invoice_lines GROUP BY 1) ig ON ig.sales_invoice_id = pl.sales_invoice_id
     LEFT JOIN (SELECT sales_invoice_id, SUM(amount) AS paid FROM sales_invoice_settlements GROUP BY 1) st ON st.sales_invoice_id = pl.sales_invoice_id`,
    [id]
  );

  const revenue = rev.map((r) => ({ id: r.id, date: r.date, number: r.number, docType: r.doc_type, client: r.client, subject: r.subject, net: Number(r.net) }));
  const costRows = costs.map((r) => ({ id: r.id, date: r.date, number: r.number, supplier: r.supplier, description: r.description, account: r.account, net: Number(r.net) }));
  const byAccount = new Map<string, number>();
  for (const c of costRows) byAccount.set(c.account, (byAccount.get(c.account) ?? 0) + c.net);
  const totalRevenue = revenue.reduce((x, r) => x + r.net, 0);
  const totalCost = costRows.reduce((x, r) => x + r.net, 0);
  return {
    project,
    revenue,
    costs: costRows,
    costsByAccount: [...byAccount.entries()].map(([account, net]) => ({ account, net })).sort((a, b) => b.net - a.net),
    totals: {
      revenue: totalRevenue,
      expenditure: totalCost,
      result: totalRevenue - totalCost,
      marginPercent: totalRevenue > 0.005 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : null,
      invoiced: Number(paid[0]?.invoiced ?? 0),
      received: Number(paid[0]?.received ?? 0),
    },
  };
}
