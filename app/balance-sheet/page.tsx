import { getBalanceSheet, type BSLine } from "@/lib/actions/balance-sheet-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { formatMoney as fmt } from "@/lib/formatters";

export const dynamic = "force-dynamic";

function Section({ title, lines, total, totalLabel }: { title: string; lines: BSLine[]; total: number; totalLabel: string }) {
  return (
    <>
      <tr>
        <td className="px-4 py-1.5 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-600" colSpan={2}>
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.subgroup_no}>
          <td className="px-4 py-1.5 pl-8 text-neutral-700">{l.name}</td>
          <td className={`px-4 py-1.5 text-right ${l.amount < 0 ? "text-credit" : ""}`}>{fmt(l.amount)}</td>
        </tr>
      ))}
      <tr className="border-t border-line font-semibold">
        <td className="px-4 py-2">{totalLabel}</td>
        <td className="px-4 py-2 text-right">{fmt(total)}</td>
      </tr>
    </>
  );
}

export default async function BalanceSheetPage() {
  const year = await getEffectiveReportingYear();
  const b = await getBalanceSheet(year);
  const balanced = Math.abs(b.difference) < 0.005;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Balance Sheet</h1>
          <p className="text-sm text-neutral-600">{b.asOf ? `As at ${b.asOf} (end of ${year})` : `As of today (${year})`}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${balanced ? "bg-debit/10 text-debit" : "bg-credit/10 text-credit"}`}>
          {balanced ? "Balanced" : `Out of balance by ${fmt(b.difference)}`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <tbody>
              <Section title="Current assets" lines={b.currentAssets} total={b.totalCurrentAssets} totalLabel="Total current assets" />
              <Section title="Non-current assets" lines={b.nonCurrentAssets} total={b.totalNonCurrentAssets} totalLabel="Total non-current assets" />
              <tr className="border-t-2 border-primary text-lg font-semibold text-primary">
                <td className="px-4 py-3">Total assets</td>
                <td className="px-4 py-3 text-right">{fmt(b.totalAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <tbody>
              <Section title="Liabilities" lines={b.liabilities} total={b.totalLiabilities} totalLabel="Total liabilities" />
              <Section title="Long-term debt" lines={b.longTermDebt} total={b.totalLongTermDebt} totalLabel="Total long-term debt" />
              <tr>
                <td className="px-4 py-1.5 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-600" colSpan={2}>
                  Equity
                </td>
              </tr>
              {b.equity.map((l) => (
                <tr key={l.subgroup_no}>
                  <td className="px-4 py-1.5 pl-8 text-neutral-700">{l.name}</td>
                  <td className="px-4 py-1.5 text-right">{fmt(l.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-1.5 pl-8 text-neutral-700">Profit kept from earlier years</td>
                <td className={`px-4 py-1.5 text-right ${b.retainedPriorYears < 0 ? "text-credit" : ""}`}>{fmt(b.retainedPriorYears)}</td>
              </tr>
              <tr>
                <td className="px-4 py-1.5 pl-8 text-neutral-700">Result of {year}</td>
                <td className={`px-4 py-1.5 text-right ${b.resultOfYear < 0 ? "text-credit" : ""}`}>{fmt(b.resultOfYear)}</td>
              </tr>
              <tr className="border-t border-line font-semibold">
                <td className="px-4 py-2">Total equity</td>
                <td className="px-4 py-2 text-right">{fmt(b.totalEquity)}</td>
              </tr>
              <tr className="border-t-2 border-primary text-lg font-semibold text-primary">
                <td className="px-4 py-3">Total liabilities and equity</td>
                <td className="px-4 py-3 text-right">{fmt(b.totalLiabilitiesAndEquity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        Built from the trial balance. Profit made up to the end of the previous year is shown as kept profit and this year&apos;s on its own line, so the two sides
        agree whenever the books themselves balance.
      </p>
    </div>
  );
}
