import Link from "next/link";
import { getInvoiceReport, getBankStatement } from "@/lib/actions/report-actions";
import { listBankAccounts } from "@/lib/actions/banking-actions";
import { listCustomerOptions, listSupplierOptions, listProjectOptions, listAllAccountOptions } from "@/lib/actions/reference-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getLabels } from "@/lib/labels";
import { parseReportQuery, type ReportQuery } from "@/lib/report-params";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const GROUP_LABEL = { party: "client / supplier", account: "account", project: "project", month: "month" } as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportQuery> }) {
  const q = await searchParams;
  const year = await getEffectiveReportingYear();
  const { view, params, bankAccountId } = parseReportQuery(q, year);
  const labels = await getLabels();

  const [parties, projects, accounts, banks] = await Promise.all([
    view === "expense" ? listSupplierOptions() : listCustomerOptions(),
    listProjectOptions(),
    listAllAccountOptions(),
    listBankAccounts(undefined, true),
  ]);
  const bank = banks.find((b) => b.id === bankAccountId) ?? banks.find((b) => b.active) ?? banks[0];
  const report = view === "bank" ? null : await getInvoiceReport(params);
  const statement = view === "bank" && bank ? await getBankStatement(bank.id, params.from, params.to) : null;

  const qs = new URLSearchParams({ type: view, from: params.from, to: params.to, status: params.status, group: params.groupBy });
  if (params.partyId) qs.set("party", String(params.partyId));
  if (params.projectId) qs.set("project", String(params.projectId));
  if (params.accountNo) qs.set("account", String(params.accountNo));
  if (view === "bank" && bank) qs.set("bank", String(bank.id));
  const tab = (t: string, label: string) => (
    <Link
      href={`/reports?type=${t}&from=${params.from}&to=${params.to}`}
      className={`rounded-md border px-3 py-1.5 text-sm ${view === t ? "border-primary bg-primary text-white" : "border-line bg-surface hover:bg-background"}`}
    >
      {label}
    </Link>
  );
  const quarterLink = (qn: number) => {
    const start = `${year}-${String((qn - 1) * 3 + 1).padStart(2, "0")}-01`;
    const endMonth = qn * 3;
    const end = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
    return `/reports?type=${view}&from=${start}&to=${end}`;
  };
  const partyName = view === "expense" ? "Supplier" : labels.client.replace(/s$/, "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Inc / Exp Report</h1>
          <p className="text-sm text-neutral-600">
            {formatDate(params.from)} to {formatDate(params.to)}
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <PrintButton />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {tab("income", "Income")}
        {tab("expense", "Expenses")}
        {tab("bank", "Bank & cash statement")}
        <span className="mx-2 text-neutral-300">|</span>
        <span className="text-xs text-neutral-500">{year}:</span>
        {[1, 2, 3, 4].map((n) => (
          <Link key={n} href={quarterLink(n)} className="rounded-md border border-line bg-surface px-2 py-1 text-xs hover:bg-background">
            Q{n}
          </Link>
        ))}
        <Link href={`/reports?type=${view}&from=${year}-01-01&to=${year}-12-31`} className="rounded-md border border-line bg-surface px-2 py-1 text-xs hover:bg-background">
          Whole year
        </Link>
      </div>

      <form method="get" className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-6 print:hidden">
        <input type="hidden" name="type" value={view} />
        <Field label="From">
          <input type="date" name="from" defaultValue={params.from} className="input" />
        </Field>
        <Field label="To">
          <input type="date" name="to" defaultValue={params.to} className="input" />
        </Field>
        {view === "bank" ? (
          <Field label="Account">
            <select name="bank" defaultValue={bank?.id} className="input">
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.active ? "" : " (closed)"}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label={partyName}>
              <select name="party" defaultValue={params.partyId ?? ""} className="input">
                <option value="">All</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={labels.project.replace(/s$/, "")}>
              <select name="project" defaultValue={params.projectId ?? ""} className="input">
                <option value="">All</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account">
              <select name="account" defaultValue={params.accountNo ?? ""} className="input">
                <option value="">All</option>
                {accounts.map((a) => (
                  <option key={a.account_no} value={a.account_no}>
                    {a.account_no} {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={params.status} className="input">
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="outstanding">Outstanding</option>
              </select>
            </Field>
            <Field label="Summarise by">
              <select name="group" defaultValue={params.groupBy} className="input">
                {(Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[]).map((g) => (
                  <option key={g} value={g}>
                    {g === "party" ? partyName : GROUP_LABEL[g].replace(/^./, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <div className="flex items-end">
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            Show
          </button>
        </div>
      </form>

      {report && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Documents" value={String(report.totals.count)} />
            <Stat label="Net (excl. IVA)" value={fmt(report.totals.net)} />
            <Stat label="IVA" value={fmt(report.totals.vat)} />
            <Stat label="Total (incl. IVA)" value={fmt(report.totals.gross)} />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">By {GROUP_LABEL[params.groupBy] === "client / supplier" ? partyName.toLowerCase() : GROUP_LABEL[params.groupBy]}</h2>
            <div className="flex gap-4 text-sm print:hidden">
              <a href={`/reports/export?${qs.toString()}&view=summary`} className="text-primary hover:underline">
                Export summary (CSV)
              </a>
              <a href={`/reports/export?${qs.toString()}&view=documents`} className="text-primary hover:underline">
                Export documents (CSV)
              </a>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2 text-right">Documents</th>
                  <th className="px-4 py-2 text-right">Net</th>
                  <th className="px-4 py-2 text-right">IVA</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">% of net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.groups.map((g) => (
                  <tr key={g.label}>
                    <td className="px-4 py-1.5">{g.label}</td>
                    <td className="px-4 py-1.5 text-right">{g.count}</td>
                    <td className="px-4 py-1.5 text-right">{fmt(g.net)}</td>
                    <td className="px-4 py-1.5 text-right">{fmt(g.vat)}</td>
                    <td className="px-4 py-1.5 text-right">{fmt(g.gross)}</td>
                    <td className="px-4 py-1.5 text-right text-neutral-600">{report.totals.net > 0.005 ? `${((g.net / report.totals.net) * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
                {report.groups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                      Nothing matches these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold text-primary">Documents</h2>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Number</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">{partyName}</th>
                  <th className="px-4 py-2 text-right">Net</th>
                  <th className="px-4 py-2 text-right">IVA</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right" title="Of the whole invoice">
                    Outstanding
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.documents.map((d) => (
                  <tr key={d.id} className="hover:bg-background">
                    <td className="px-4 py-1.5">{formatDate(d.date)}</td>
                    <td className="px-4 py-1.5">{d.number}</td>
                    <td className="px-4 py-1.5 text-neutral-600">{d.docType}</td>
                    <td className="px-4 py-1.5">{d.party}</td>
                    <td className="px-4 py-1.5 text-right">{fmt(d.net)}</td>
                    <td className="px-4 py-1.5 text-right">{fmt(d.vat)}</td>
                    <td className="px-4 py-1.5 text-right">{fmt(d.gross)}</td>
                    <td className={`px-4 py-1.5 text-right ${d.invoiceOutstanding >= 0.005 ? "text-credit" : "text-neutral-400"}`}>{d.invoiceOutstanding >= 0.005 ? fmt(d.invoiceOutstanding) : "paid"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary font-semibold">
                  <td className="px-4 py-2" colSpan={4}>
                    Total
                  </td>
                  <td className="px-4 py-2 text-right">{fmt(report.totals.net)}</td>
                  <td className="px-4 py-2 text-right">{fmt(report.totals.vat)}</td>
                  <td className="px-4 py-2 text-right">{fmt(report.totals.gross)}</td>
                  <td className="px-4 py-2 text-right">{fmt(report.totals.outstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            Amounts are the lines that match the filters; Outstanding is for the whole invoice. Proforma invoices are never included.
          </p>
        </>
      )}

      {view === "bank" && !statement && <p className="text-sm text-neutral-600">No bank account to report on.</p>}
      {statement && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">
              {statement.account.name} <span className="text-sm font-normal text-neutral-500">account {statement.account.account_no}</span>
            </h2>
            <a href={`/reports/export?${qs.toString()}&view=bank`} className="text-sm text-primary hover:underline print:hidden">
              Export statement (CSV)
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Opening balance" value={fmt(statement.opening)} />
            <Stat label="Money in" value={fmt(statement.totalIn)} />
            <Stat label="Money out" value={fmt(statement.totalOut)} />
            <Stat label="Closing balance" value={fmt(statement.closing)} />
          </div>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[56rem] table-fixed text-sm">
              <colgroup>
                <col style={{ width: "7rem" }} />
                <col style={{ width: "30%" }} />
                <col />
                <col style={{ width: "8.5rem" }} />
                <col style={{ width: "8.5rem" }} />
                <col style={{ width: "9rem" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Linked to</th>
                  <th className="px-4 py-2 text-right">In</th>
                  <th className="px-4 py-2 text-right">Out</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {statement.rows.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-1.5">{formatDate(t.payment_date)}</td>
                    <td className="px-4 py-1.5">{t.description}</td>
                    <td className="px-4 py-1.5 text-neutral-600">
                      {t.link_label}
                      {t.employee_name ? ` · ${t.employee_name}` : ""}
                    </td>
                    <td className="px-4 py-1.5 text-right text-debit">{t.in_amount + t.in_vat > 0 ? fmt(t.in_amount + t.in_vat) : ""}</td>
                    <td className="px-4 py-1.5 text-right text-credit">{t.out_amount + t.out_vat > 0 ? fmt(t.out_amount + t.out_vat) : ""}</td>
                    <td className="px-4 py-1.5 text-right font-medium">{fmt(t.balance)}</td>
                  </tr>
                ))}
                {statement.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                      No movements in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-xl font-semibold text-primary">{value}</span>
    </div>
  );
}
