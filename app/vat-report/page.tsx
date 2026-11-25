import Link from "next/link";
import { Fragment } from "react";
import { getVatReportMonthly, type VatMonthRow } from "@/lib/actions/vat-report-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { queryOne } from "@/lib/db";
import { formatMoney as fmt } from "@/lib/formatters";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const netClass = (n: number) => (n > 0 ? "text-credit" : n < 0 ? "text-debit" : "");

export default async function VatReportPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const year = await getEffectiveReportingYear();
  const monthlyFiler = (await queryOne<{ p: string }>("SELECT vat_return_period AS p FROM app_settings WHERE id = 1"))?.p === "monthly";
  const { rows, totalOutput, totalInput, totalNet } = await getVatReportMonthly(showAll ? undefined : year);

  // Months in order, with a subtotal line after the last month of each quarter that has figures.
  const groups: { key: string; year: number; quarter: number; months: VatMonthRow[] }[] = [];
  for (const r of rows) {
    const key = `${r.year}-${r.quarter}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.months.push(r);
    else groups.push({ key, year: r.year, quarter: r.quarter, months: [r] });
  }

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
              <th className="px-4 py-2">Month</th>
              <th className="px-4 py-2 text-right">Output VAT (sales)</th>
              <th className="px-4 py-2 text-right">Input VAT (purchases)</th>
              <th className="px-4 py-2 text-right">Net VAT</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const out = g.months.reduce((s, m) => s + m.outputVat, 0);
              const inn = g.months.reduce((s, m) => s + m.inputVat, 0);
              return (
                <Fragment key={g.key}>
                  {g.months.map((r) => (
                    <tr key={`${r.year}-${r.month}`} className="border-b border-line hover:bg-background">
                      <td className="px-4 py-2 font-medium">
                        {MONTHS[r.month - 1]} {r.year}
                      </td>
                      <td className="px-4 py-2 text-right">{fmt(r.outputVat)}</td>
                      <td className="px-4 py-2 text-right">{fmt(r.inputVat)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${netClass(r.netVat)}`}>{fmt(r.netVat)}</td>
                    </tr>
                  ))}
                  {!monthlyFiler && <tr className="border-b border-line bg-background font-semibold">
                    <td className="px-4 py-2">
                      {g.year} Q{g.quarter} total
                    </td>
                    <td className="px-4 py-2 text-right">{fmt(out)}</td>
                    <td className="px-4 py-2 text-right">{fmt(inn)}</td>
                    <td className={`px-4 py-2 text-right ${netClass(out - inn)}`}>{fmt(out - inn)}</td>
                  </tr>}
                </Fragment>
              );
            })}
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
                <td className="px-4 py-2">{showAll ? "Total, all years" : `Total ${year}`}</td>
                <td className="px-4 py-2 text-right">{fmt(totalOutput)}</td>
                <td className="px-4 py-2 text-right">{fmt(totalInput)}</td>
                <td className="px-4 py-2 text-right">{fmt(totalNet)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        Positive net VAT is payable to the tax authority; negative is refundable. VAT is counted in the month of the invoice date. {monthlyFiler
          ? "This company files its VAT return monthly (change it in Settings)."
          : "This company files its VAT return quarterly, so quarter totals are shown (change it in Settings). Quarters assume a January-start fiscal year."}
      </p>
    </div>
  );
}
