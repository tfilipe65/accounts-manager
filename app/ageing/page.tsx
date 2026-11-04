import { getReceivablesAgeing, getPayablesAgeing, type AgeingRow } from "@/lib/actions/ageing-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { reportingYearCutoffDate } from "@/lib/reporting-year-utils";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";

function AgeingTable({ title, rows, totalOutstanding, partyLabel }: { title: string; rows: AgeingRow[]; totalOutstanding: number; partyLabel: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <span className="text-sm text-neutral-600">Total outstanding: {fmt(totalOutstanding)}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Invoice #</th>
              <th className="px-4 py-2">{partyLabel}</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2">Ageing</th>
              <th className="px-4 py-2 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-background">
                <td className="px-4 py-2 font-medium">{r.invoice_number}</td>
                <td className="px-4 py-2">{r.party_name}</td>
                <td className="px-4 py-2">{formatDate(r.date)}</td>
                <td className="px-4 py-2">{formatDate(r.due_date)}</td>
                <td className={`px-4 py-2 ${r.days_overdue > 0 ? "font-medium text-credit" : "text-neutral-500"}`}>{r.bucket}</td>
                <td className="px-4 py-2 text-right">{fmt(r.outstanding)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-center text-neutral-500" colSpan={6}>
                  Nothing outstanding.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function AgeingPage() {
  const year = await getEffectiveReportingYear();
  const cutoff = reportingYearCutoffDate(year);
  const [receivables, payables] = await Promise.all([
    getReceivablesAgeing(cutoff ?? undefined),
    getPayablesAgeing(cutoff ?? undefined),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Ageing</h1>
        <p className="text-sm text-neutral-600">{cutoff ? `As of ${cutoff} (end of ${year})` : "As of today"}</p>
      </div>
      <AgeingTable title="Accounts Receivable" rows={receivables.rows} totalOutstanding={receivables.totalOutstanding} partyLabel="Client" />
      <AgeingTable title="Accounts Payable" rows={payables.rows} totalOutstanding={payables.totalOutstanding} partyLabel="Supplier" />
    </div>
  );
}
