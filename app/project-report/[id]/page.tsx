import { taxify } from "@/lib/tax-label";
import { getLabels } from "@/lib/labels";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project-report-actions";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";
import PrintButton from "@/components/PrintButton";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const taxLabel = (await getLabels()).tax;
  const tx = (s: string) => taxify(s, taxLabel);
  const { id } = await params;
  const d = await getProjectDetail(Number(id));
  if (!d) notFound();
  const { project: p, totals: t } = d;
  const stillToCollect = t.invoiced - t.received;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/project-report" className="text-sm text-primary hover:underline print:hidden">
            &larr; All projects
          </Link>
          <h1 className="text-2xl font-semibold text-primary">
            {p.code} &mdash; {p.name}
          </h1>
          <p className="text-sm text-neutral-600">
            {p.status ?? "No status"}
            {p.start_date ? ` · from ${formatDate(p.start_date)}` : ""}
            {p.end_date ? ` · to ${formatDate(p.end_date)}` : ""}
            {tx(" · amounts without VAT")}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Revenue" value={fmt(t.revenue)} />
        <Card label="Expenditure" value={fmt(t.expenditure)} />
        <Card label="Result" value={fmt(t.result)} tone={t.result < 0 ? "bad" : "good"} note={t.marginPercent != null ? `${t.marginPercent.toFixed(1)}% of revenue` : undefined} />
        <Card label="Still to collect" value={fmt(stillToCollect)} note={`${fmt(t.received)} received of ${fmt(t.invoiced)} invoiced (${tx("with VAT")})`} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary">Revenue</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.revenue.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{formatDate(r.date)}</td>
                  <td className="px-4 py-2">
                    {r.number}
                    {r.docType !== "Invoice" ? <span className="ml-1 text-xs text-neutral-500">({r.docType})</span> : null}
                  </td>
                  <td className="px-4 py-2">{r.client}</td>
                  <td className="px-4 py-2">{r.subject}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.net)}</td>
                </tr>
              ))}
              {d.revenue.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-neutral-500" colSpan={5}>
                    No invoices are booked to this project yet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary font-semibold">
                <td className="px-4 py-2" colSpan={4}>
                  Total revenue
                </td>
                <td className="px-4 py-2 text-right">{fmt(t.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary">Expenditure</h2>
        {d.costsByAccount.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-700">
            {d.costsByAccount.map((c) => (
              <span key={c.account}>
                {c.account}: <strong>{fmt(c.net)}</strong>
              </span>
            ))}
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.costs.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{formatDate(r.date)}</td>
                  <td className="px-4 py-2">{r.number}</td>
                  <td className="px-4 py-2">{r.supplier}</td>
                  <td className="px-4 py-2">{r.description}</td>
                  <td className="px-4 py-2">{r.account}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.net)}</td>
                </tr>
              ))}
              {d.costs.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-neutral-500" colSpan={6}>
                    No costs are booked to this project yet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary font-semibold">
                <td className="px-4 py-2" colSpan={5}>
                  Total expenditure
                </td>
                <td className="px-4 py-2 text-right">{fmt(t.expenditure)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</span>
      <span className={`text-xl font-semibold ${tone === "bad" ? "text-credit" : tone === "good" ? "text-debit" : "text-primary"}`}>{value}</span>
      {note && <span className="text-xs text-neutral-500">{note}</span>}
    </div>
  );
}
