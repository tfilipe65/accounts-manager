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
