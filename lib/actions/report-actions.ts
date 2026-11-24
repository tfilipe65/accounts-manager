"use server";

// Income / Expense reports and bank statements for a period.
//
// The invoice reports are built from invoice LINES (so they can be filtered and summarised by account
// or project). A document row sums only the lines that match the filters, shown with the paid and
// outstanding of the whole invoice. Proforma invoices never appear: they are quotes, not income.

import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { listBankAccounts, type BankTransactionRow } from "@/lib/actions/banking-actions";

export type ReportKind = "income" | "expense";
export type GroupBy = "party" | "account" | "project" | "month";
export type StatusFilter = "all" | "paid" | "outstanding";

export type ReportParams = {
  kind: ReportKind;
  from: string;
  to: string;
  partyId: number | null;
  projectId: number | null;
  accountNo: number | null;
  status: StatusFilter;
  groupBy: GroupBy;
};

export type ReportDocument = {
  id: number;
  number: string;
  date: string;
  docType: string;
  party: string;
  net: number;
  vat: number;
  gross: number;
  invoiceGross: number;
  invoicePaid: number;
  invoiceOutstanding: number;
};
export type ReportGroup = { label: string; count: number; net: number; vat: number; gross: number };
export type InvoiceReport = {
  documents: ReportDocument[];
  groups: ReportGroup[];
  totals: { count: number; net: number; vat: number; gross: number; outstanding: number };
};

type LineRow = {
  id: number;
  number: string;
  date: string;
  doc_type: string;
  party: string;
  group_party: string;
  group_account: string;
  group_project: string;
  month: string;
  net: string;
  vat: string;
  gross: string;
  invoice_gross: string;
  invoice_paid: string;
};

export async function getInvoiceReport(p: ReportParams): Promise<InvoiceReport> {
  await requireSession();
  const params = [p.from, p.to, p.partyId, p.projectId, p.accountNo];

  const sql =
    p.kind === "income"
      ? `SELECT si.id, si.invoice_number AS number, si.date::text AS date, si.doc_type, c.name AS party,
                c.name AS group_party,
                l.account_no || ' ' || a.name AS group_account,
                COALESCE(pr.code || ' - ' || pr.name, '(no project)') AS group_project,
                to_char(si.date, 'YYYY-MM') AS month,
                l.quantity * l.price_ex_vat * (1 - l.discount_perc) AS net,
                l.quantity * l.price_ex_vat * (1 - l.discount_perc) * l.vat_perc AS vat,
                l.quantity * l.price_ex_vat * (1 - l.discount_perc) * (1 + l.vat_perc) AS gross,
                COALESCE(ig.gross, 0) AS invoice_gross, COALESCE(ip.paid, 0) AS invoice_paid
         FROM sales_invoice_lines l
         JOIN sales_invoices si ON si.id = l.sales_invoice_id
         JOIN customers c ON c.id = si.customer_id
         JOIN accounts a ON a.account_no = l.account_no
         LEFT JOIN projects pr ON pr.id = l.project_id
         LEFT JOIN (SELECT sales_invoice_id, SUM(quantity * price_ex_vat * (1 - discount_perc) * (1 + vat_perc)) AS gross
                    FROM sales_invoice_lines GROUP BY 1) ig ON ig.sales_invoice_id = si.id
         LEFT JOIN (SELECT sales_invoice_id, SUM(in_amount + in_vat) AS paid FROM bank_transactions WHERE sales_invoice_id IS NOT NULL GROUP BY 1) ip
                ON ip.sales_invoice_id = si.id
         WHERE si.date >= $1::date AND si.date <= $2::date AND si.doc_type <> 'Proforma'
           AND ($3::int IS NULL OR si.customer_id = $3) AND ($4::int IS NULL OR l.project_id = $4) AND ($5::int IS NULL OR l.account_no = $5)
         ORDER BY si.date, si.invoice_number, l.line_no`
      : `SELECT pi.id, pi.invoice_number AS number, pi.date::text AS date, 'Invoice' AS doc_type, s.name AS party,
                s.name AS group_party,
                l.account_no || ' ' || a.name AS group_account,
                COALESCE(pr.code || ' - ' || pr.name, '(no project)') AS group_project,
                to_char(pi.date, 'YYYY-MM') AS month,
                l.amount_inc_vat / (1 + l.vat_perc) AS net,
                l.amount_inc_vat - l.amount_inc_vat / (1 + l.vat_perc) AS vat,
                l.amount_inc_vat AS gross,
                COALESCE(ig.gross, 0) AS invoice_gross, COALESCE(ip.paid, 0) AS invoice_paid
         FROM purchase_invoice_lines l
         JOIN purchase_invoices pi ON pi.id = l.purchase_invoice_id
         JOIN suppliers s ON s.id = pi.supplier_id
         JOIN accounts a ON a.account_no = l.account_no
         LEFT JOIN projects pr ON pr.id = l.project_id
         LEFT JOIN (SELECT purchase_invoice_id, SUM(amount_inc_vat) AS gross FROM purchase_invoice_lines GROUP BY 1) ig ON ig.purchase_invoice_id = pi.id
         LEFT JOIN (SELECT purchase_invoice_id, SUM(out_amount + out_vat) AS paid FROM bank_transactions WHERE purchase_invoice_id IS NOT NULL GROUP BY 1) ip
                ON ip.purchase_invoice_id = pi.id
         WHERE pi.date >= $1::date AND pi.date <= $2::date
           AND ($3::int IS NULL OR pi.supplier_id = $3) AND ($4::int IS NULL OR l.project_id = $4) AND ($5::int IS NULL OR l.account_no = $5)
         ORDER BY pi.date, pi.invoice_number, l.line_no`;

  const lines = await query<LineRow>(sql, params);

  const keep = (r: LineRow): boolean => {
    const outstanding = Number(r.invoice_gross) - Number(r.invoice_paid);
    if (p.status === "paid") return outstanding < 0.005;
    if (p.status === "outstanding") return outstanding >= 0.005;
    return true;
  };

  const docs = new Map<number, ReportDocument>();
  const groups = new Map<string, ReportGroup>();
  const groupKey = (r: LineRow) => (p.groupBy === "party" ? r.group_party : p.groupBy === "account" ? r.group_account : p.groupBy === "project" ? r.group_project : r.month);
  const seenInGroup = new Set<string>();

  for (const r of lines.filter(keep)) {
    const net = Number(r.net);
    const vat = Number(r.vat);
    const gross = Number(r.gross);
    const doc = docs.get(r.id) ?? {
      id: r.id,
      number: r.number,
      date: r.date,
      docType: r.doc_type,
      party: r.party,
      net: 0,
      vat: 0,
      gross: 0,
      invoiceGross: Number(r.invoice_gross),
      invoicePaid: Number(r.invoice_paid),
      invoiceOutstanding: Number(r.invoice_gross) - Number(r.invoice_paid),
    };
    doc.net += net;
    doc.vat += vat;
    doc.gross += gross;
    docs.set(r.id, doc);

    const key = groupKey(r);
    const g = groups.get(key) ?? { label: key, count: 0, net: 0, vat: 0, gross: 0 };
    g.net += net;
    g.vat += vat;
    g.gross += gross;
    if (!seenInGroup.has(`${key}|${r.id}`)) {
      seenInGroup.add(`${key}|${r.id}`);
      g.count += 1;
    }
    groups.set(key, g);
  }

  const documents = Array.from(docs.values());
  return {
    documents,
    groups: Array.from(groups.values()).sort((a, b) => (p.groupBy === "month" ? a.label.localeCompare(b.label) : b.net - a.net)),
    totals: {
      count: documents.length,
      net: documents.reduce((s, d) => s + d.net, 0),
      vat: documents.reduce((s, d) => s + d.vat, 0),
      gross: documents.reduce((s, d) => s + d.gross, 0),
      outstanding: documents.reduce((s, d) => s + d.invoiceOutstanding, 0),
    },
  };
}

export type BankStatement = {
  account: { id: number; name: string; account_no: number };
  opening: number;
  closing: number;
  rows: (BankTransactionRow & { balance: number })[];
  totalIn: number;
  totalOut: number;
};

/** A bank or cash statement for a period: the balance before it, every line, and the balance after. */
export async function getBankStatement(bankAccountId: number, from: string, to: string): Promise<BankStatement | null> {
  await requireSession();
  const dayBefore = new Date(Date.parse(from + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  const accounts = await listBankAccounts(dayBefore, true);
  const account = accounts.find((a) => a.id === bankAccountId);
  if (!account) return null;

  const rows = await query<{
    id: number;
    payment_date: string;
    description: string | null;
    link_label: string | null;
    employee_name: string | null;
    transfer_id: string | null;
    reconciled: boolean;
    in_amount: string;
    in_vat: string;
    out_amount: string;
    out_vat: string;
  }>(
    `SELECT bt.id, bt.payment_date::text AS payment_date, bt.description, bt.transfer_id, bt.reconciled, e.name AS employee_name,
            CASE WHEN bt.transfer_id IS NOT NULL THEN 'Transfer between accounts'
                 WHEN si.invoice_number IS NOT NULL THEN 'Sales invoice ' || si.invoice_number
                 WHEN pi.invoice_number IS NOT NULL THEN 'Purchase invoice ' || pi.invoice_number
                 WHEN a.account_no IS NOT NULL THEN a.account_no || ' ' || a.name END AS link_label,
            bt.in_amount, bt.in_vat, bt.out_amount, bt.out_vat
     FROM bank_transactions bt
     LEFT JOIN sales_invoices si ON si.id = bt.sales_invoice_id
     LEFT JOIN purchase_invoices pi ON pi.id = bt.purchase_invoice_id
     LEFT JOIN accounts a ON a.account_no = bt.account_no
     LEFT JOIN employees e ON e.id = bt.employee_id
     WHERE bt.bank_account_id = $1 AND bt.payment_date >= $2::date AND bt.payment_date <= $3::date
     ORDER BY bt.payment_date, bt.id`,
    [bankAccountId, from, to]
  );

  let running = account.balance;
  let totalIn = 0;
  let totalOut = 0;
  const out = rows.map((r) => {
    const inn = Number(r.in_amount) + Number(r.in_vat);
    const outAmt = Number(r.out_amount) + Number(r.out_vat);
    running += inn - outAmt;
    totalIn += inn;
    totalOut += outAmt;
    return {
      id: r.id,
      payment_date: r.payment_date,
      description: r.description,
      link_label: r.link_label,
      employee_name: r.employee_name,
      transfer_id: r.transfer_id,
      reconciled: r.reconciled,
      vat_perc: null,
      in_amount: Number(r.in_amount),
      in_vat: Number(r.in_vat),
      out_amount: Number(r.out_amount),
      out_vat: Number(r.out_vat),
      balance: running,
    };
  });
  return { account: { id: account.id, name: account.name, account_no: account.account_no }, opening: account.balance, closing: running, rows: out, totalIn, totalOut };
}
