import Link from "next/link";
import { getVatReport } from "@/lib/actions/vat-report-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { formatMoney as fmt } from "@/lib/formatters";

export default async function VatReportPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const year = await getEffectiveReportingYear();
  const { rows, totalOutput, totalInput, totalNet } = await getVatReport(showAll ? undefined : year);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">VAT Report</h1>
        <Link href={showAll ? "/vat-report" : "/vat-report?all=1"} className="text-sm text-primary hover:underline">
          {showAll ? `Show ${year} only` : "Show all years"}
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2 text-right">Output VAT (sales)</th>
              <th className="px-4 py-2 text-right">Input VAT (purchases)</th>
              <th className="px-4 py-2 text-right">Net VAT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={`${r.year}-${r.quarter}`} className="hover:bg-background">
                <td className="px-4 py-2 font-medium">
                  {r.year} Q{r.quarter}
                </td>
                <td className="px-4 py-2 text-right">{fmt(r.outputVat)}</td>
                <td className="px-4 py-2 text-right">{fmt(r.inputVat)}</td>
                <td className={`px-4 py-2 text-right font-medium ${r.netVat > 0 ? "text-credit" : r.netVat < 0 ? "text-debit" : ""}`}>
                  {fmt(r.netVat)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-neutral-500" colSpan={4}>
                  No sales or purchase invoices yet.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-primary font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">{fmt(totalOutput)}</td>
                <td className="px-4 py-2 text-right">{fmt(totalInput)}</td>
                <td className="px-4 py-2 text-right">{fmt(totalNet)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        Positive net VAT is payable to the tax authority; negative is refundable. Assumes a January-start fiscal year.
      </p>
    </div>
  );
}
