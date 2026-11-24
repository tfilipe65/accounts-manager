import Link from "next/link";
import { getStatement } from "@/lib/actions/pl-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { buildRows, periodLabels } from "@/lib/pl-rows";
import { sum } from "@/lib/pl-structure";
import { formatMoney as fmt } from "@/lib/formatters";
import StatementTable from "@/components/StatementTable";

export const dynamic = "force-dynamic";

export default async function IncomeStatementPage() {
  const year = await getEffectiveReportingYear();
  const [s, previous] = await Promise.all([getStatement(year), getStatement(year - 1)]);
  const rows = buildRows(s, "months");
  const revenue = sum(s.revenue);

  const compare: { label: string; now: number; before: number }[] = [
    { label: "Revenue", now: revenue, before: sum(previous.revenue) },
    { label: "Gross profit", now: sum(s.grossProfit), before: sum(previous.grossProfit) },
    { label: "Operating expenses", now: sum(s.operatingExpenses), before: sum(previous.operatingExpenses) },
    { label: "Operating result", now: sum(s.operatingResult), before: sum(previous.operatingResult) },
    { label: "Net income", now: sum(s.netIncome), before: sum(previous.netIncome) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Income Statement</h1>
          <p className="text-sm text-neutral-600">Reporting year {year}, month by month.</p>
        </div>
        <Link href="/profit-and-loss" className="text-sm text-primary hover:underline">
          By quarter &rarr;
        </Link>
      </div>

      <StatementTable columns={periodLabels("months")} rows={rows} revenueTotal={revenue} compact />

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary">Against {year - 1}</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2" />
                <th className="px-4 py-2 text-right">{year}</th>
                <th className="px-4 py-2 text-right">{year - 1}</th>
                <th className="px-4 py-2 text-right">Change</th>
                <th className="px-4 py-2 text-right">Change %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {compare.map((c) => (
                <tr key={c.label}>
                  <td className="px-4 py-2 font-medium">{c.label}</td>
                  <td className="px-4 py-2 text-right">{fmt(c.now)}</td>
                  <td className="px-4 py-2 text-right text-neutral-600">{fmt(c.before)}</td>
                  <td className="px-4 py-2 text-right">{fmt(c.now - c.before)}</td>
                  <td className="px-4 py-2 text-right text-neutral-600">
                    {Math.abs(c.before) > 0.005 ? `${(((c.now - c.before) / Math.abs(c.before)) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
