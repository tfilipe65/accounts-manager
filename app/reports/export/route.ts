import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getInvoiceReport, getBankStatement } from "@/lib/actions/report-actions";
import { listBankAccounts } from "@/lib/actions/banking-actions";
import { parseReportQuery } from "@/lib/report-params";
import { csvResponse, toCsv } from "@/lib/csv";

// /reports/export?<same filters as the page>&view=summary|documents|bank
export async function GET(req: NextRequest) {
  if (!(await getSession())) return new Response("Sign in first", { status: 401 });
  const q = Object.fromEntries(req.nextUrl.searchParams.entries());
  const year = await getEffectiveReportingYear();
  const { view, params, bankAccountId } = parseReportQuery(q, year);
  const what = req.nextUrl.searchParams.get("view");
  const money = (n: number) => n.toFixed(2);

  if (view === "bank") {
    const banks = await listBankAccounts(undefined, true);
    const bank = banks.find((b) => b.id === bankAccountId) ?? banks[0];
    const statement = bank ? await getBankStatement(bank.id, params.from, params.to) : null;
    if (!statement) return new Response("No account", { status: 404 });
    const body = toCsv(
      ["Date", "Description", "Linked to", "Employee", "In", "Out", "Balance"],
      [
        ["", "Opening balance", "", "", "", "", money(statement.opening)],
        ...statement.rows.map((t) => [
          t.payment_date,
          t.description,
          t.link_label,
          t.employee_name,
          t.in_amount + t.in_vat ? money(t.in_amount + t.in_vat) : "",
          t.out_amount + t.out_vat ? money(t.out_amount + t.out_vat) : "",
          money(t.balance),
        ]),
        ["", "Closing balance", "", "", money(statement.totalIn), money(statement.totalOut), money(statement.closing)],
      ]
    );
    return csvResponse(`${statement.account.name} ${params.from} to ${params.to}.csv`, body);
  }

  const report = await getInvoiceReport(params);
  const name = `${view === "income" ? "Income" : "Expenses"} ${params.from} to ${params.to}`;
  if (what === "summary") {
    return csvResponse(
      `${name} by ${params.groupBy}.csv`,
      toCsv(
        ["Group", "Documents", "Net", "IVA", "Total"],
        report.groups.map((g) => [g.label, g.count, money(g.net), money(g.vat), money(g.gross)])
      )
    );
  }
  return csvResponse(
    `${name}.csv`,
    toCsv(
      ["Date", "Number", "Type", view === "income" ? "Client" : "Supplier", "Net", "IVA", "Total", "Outstanding (whole invoice)"],
      report.documents.map((d) => [d.date, d.number, d.docType, d.party, money(d.net), money(d.vat), money(d.gross), money(d.invoiceOutstanding)])
    )
  );
}
