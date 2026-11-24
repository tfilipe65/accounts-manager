import Link from "next/link";
import { getStatement } from "@/lib/actions/pl-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { buildRows, periodLabels } from "@/lib/pl-rows";
import { sum } from "@/lib/pl-structure";
import StatementTable from "@/components/StatementTable";

export const dynamic = "force-dynamic";

export default async function ProfitAndLossPage() {
  const year = await getEffectiveReportingYear();
  const s = await getStatement(year);
  const rows = buildRows(s, "quarters");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Profit &amp; Loss</h1>
          <p className="text-sm text-neutral-600">Reporting year {year}, by quarter, with each line as a share of sales.</p>
        </div>
        <Link href="/income-statement" className="text-sm text-primary hover:underline">
          Month by month &rarr;
        </Link>
      </div>
      <StatementTable columns={periodLabels("quarters")} rows={rows} revenueTotal={sum(s.revenue)} />
      <p className="text-xs text-neutral-500">
        Operating expenses are the overheads of running the business. Other income &amp; gains and other expenses &amp; losses sit below the operating result, so
        one-off items do not flatter or hide how the core business performed. Proforma invoices are never counted.
      </p>
    </div>
  );
}
