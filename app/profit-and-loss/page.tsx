import { getYearlyPL } from "@/lib/actions/pl-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { formatMoney as fmt } from "@/lib/formatters";

export default async function ProfitAndLossPage() {
  const year = await getEffectiveReportingYear();
  const pl = await getYearlyPL(year);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Profit &amp; Loss</h1>
      <p className="text-sm text-neutral-600">Reporting year {year}.</p>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            <Row label="Revenue" amount={pl.revenue} bold />
            <Row label="Cost of Sales" amount={pl.costOfSales} negative />
            <Row label="Gross Profit" amount={pl.grossProfit} bold border />

            <tr>
              <td className="px-4 py-1.5 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-600" colSpan={2}>
                Operating Expenses
              </td>
            </tr>
            {pl.expensesBySubgroup.map((l) => (
              <Row key={l.subgroup_no} label={l.subgroup_name} amount={l.amount} indent />
            ))}
            <Row label="Total Expenses" amount={pl.totalExpenses} negative bold />

            <Row label="Net Income" amount={pl.netIncome} bold border large />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  label,
  amount,
  bold,
  negative,
  border,
  indent,
  large,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  negative?: boolean;
  border?: boolean;
  indent?: boolean;
  large?: boolean;
}) {
  return (
    <tr className={border ? "border-t-2 border-primary" : ""}>
      <td className={`px-4 py-2 ${indent ? "pl-8 text-neutral-600" : ""} ${bold ? "font-semibold" : ""} ${large ? "text-lg text-primary" : ""}`}>
        {label}
      </td>
      <td className={`px-4 py-2 text-right ${bold ? "font-semibold" : ""} ${large ? "text-lg text-primary" : ""} ${amount < 0 ? "text-credit" : ""}`}>
        {negative ? `(${fmt(Math.abs(amount))})` : fmt(amount)}
      </td>
    </tr>
  );
}
