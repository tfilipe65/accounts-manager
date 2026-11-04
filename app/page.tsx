import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/actions/dashboard-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { formatMoney as fmt } from "@/lib/formatters";
import BalanceWarningBanner from "@/components/BalanceWarningBanner";
import BarChart from "@/components/BarChart";

// Categorical slots 1 (blue) and 2 (orange) from the house dataviz palette --
// validated CVD-safe as an adjacent pair, used here for the only two-series
// chart on this page (Sales vs Costs). Every other chart is single-series
// (no legend needed) or signed (good/bad, using the app's own debit/credit
// tokens), per the dataviz skill's "color follows the job" rule.
const SALES_COLOR = "#2a78d6";
const COSTS_COLOR = "#eb6834";

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "debit" | "credit" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <span className={`text-2xl font-semibold ${tone === "credit" ? "text-credit" : tone === "debit" ? "text-debit" : "text-primary"}`}>{value}</span>
      {sub && <span className="text-xs text-neutral-500">{sub}</span>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {children}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const effectiveYear = await getEffectiveReportingYear();
  const s = await getDashboardSummary(effectiveYear);

  const monthlyCategories = s.monthly.map((m) => m.month);
  const salesCostsData = s.monthly.map((m) => ({ sales: m.sales, costs: m.costs }));
  const resultData = s.monthly.map((m) => ({ result: m.sales - m.costs }));
  const cashflowData = s.monthly.map((m) => ({ cashflow: m.cashflow }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Dashboard</h1>
      <p className="text-sm text-neutral-600">
        Welcome, {session.name}. Showing reporting year {s.reportingYear} — change it from the nav.
      </p>

      <BalanceWarningBanner diagnostics={s.diagnostics} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Cash position" value={fmt(s.totalCash)} sub="All bank accounts + cash, current" />
        <StatCard
          label="Outstanding Sales Invoices"
          value={fmt(s.receivables.amount)}
          sub={`${s.receivables.count} invoices, ${s.receivables.overdueCount} overdue (${fmt(s.receivables.overdueAmount)})`}
          tone={s.receivables.overdueCount > 0 ? "credit" : undefined}
        />
        <StatCard
          label="Outstanding Purchase Invoices"
          value={fmt(s.payables.amount)}
          sub={`${s.payables.count} invoices, ${s.payables.overdueCount} overdue (${fmt(s.payables.overdueAmount)})`}
          tone={s.payables.overdueCount > 0 ? "credit" : undefined}
        />
        <StatCard label="Sales" value={fmt(s.salesYtd)} tone="debit" />
        <StatCard label="Costs" value={fmt(s.costsYtd)} tone="credit" />
        <StatCard label="Result" value={fmt(s.resultYtd)} tone={s.resultYtd >= 0 ? "debit" : "credit"} />
        <StatCard label="Business Overhead %" value={s.overheadPerc != null ? `${(s.overheadPerc * 100).toFixed(1)}%` : "—"} sub="Operating expenses / Sales" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCard title={`Sales & Costs by month (${s.reportingYear})`}>
          <BarChart
            categories={monthlyCategories}
            series={[
              { key: "sales", label: "Sales", color: SALES_COLOR },
              { key: "costs", label: "Costs", color: COSTS_COLOR },
            ]}
            data={salesCostsData}
            money
          />
        </ChartCard>
        <ChartCard title={`Result by month (${s.reportingYear})`}>
          <BarChart
            categories={monthlyCategories}
            series={[{ key: "result", label: "Result", color: SALES_COLOR }]}
            data={resultData}
            money
            signed
          />
        </ChartCard>
        <ChartCard title={`Cashflow by month (${s.reportingYear})`}>
          <BarChart
            categories={monthlyCategories}
            series={[{ key: "cashflow", label: "Cashflow", color: SALES_COLOR }]}
            data={cashflowData}
            money
            signed
          />
        </ChartCard>
        <div className="grid grid-cols-1 gap-4">
          <ChartCard title="Ageing — Sales (outstanding by age)">
            <BarChart
              categories={s.receivablesByBucket.map((b) => b.bucket)}
              series={[{ key: "amount", label: "Outstanding", color: "var(--primary)" }]}
              data={s.receivablesByBucket.map((b) => ({ amount: b.amount }))}
              money
              height={110}
            />
          </ChartCard>
          <ChartCard title="Ageing — Purchases (outstanding by age)">
            <BarChart
              categories={s.payablesByBucket.map((b) => b.bucket)}
              series={[{ key: "amount", label: "Outstanding", color: "var(--primary)" }]}
              data={s.payablesByBucket.map((b) => ({ amount: b.amount }))}
              money
              height={110}
            />
          </ChartCard>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Top 5 Best Customers ({s.reportingYear})</h2>
          <Link href="/top10" className="text-sm text-primary hover:underline">
            See all-time Top 10s &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {s.bestCustomers.map((c, i) => (
                <tr key={c.name}>
                  <td className="w-8 px-4 py-2 text-neutral-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-right">{fmt(c.amount)}</td>
                </tr>
              ))}
              {s.bestCustomers.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-neutral-500" colSpan={3}>
                    No sales yet this reporting year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
