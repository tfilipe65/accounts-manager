import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDashboard, type BucketTotal, type KeyFigures, type Ranked } from "@/lib/actions/dashboard-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getLabels } from "@/lib/labels";
import { formatMoney as fmt } from "@/lib/formatters";
import type { Metric, MetricStatus } from "@/lib/metrics";
import BalanceWarningBanner from "@/components/BalanceWarningBanner";
import BarChart from "@/components/BarChart";
import LineChart from "@/components/LineChart";
import DonutChart from "@/components/DonutChart";
import HBarChart from "@/components/HBarChart";

export const dynamic = "force-dynamic";

// Categorical slots 1 (blue) and 2 (orange) from the house dataviz palette -- validated CVD-safe as an
// adjacent pair -- for the two-series charts (sales vs costs, money in vs out). Result lines and signed
// bars use the app's own debit/credit tokens.
const SALES_COLOR = "#2a78d6";
const COSTS_COLOR = "#eb6834";
const RESULT_COLOR = "var(--debit)";

const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

function StatCard({ label, value, sub, tone, children }: { label: string; value: string; sub?: string; tone?: "debit" | "credit"; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <span className={`text-2xl font-semibold ${tone === "credit" ? "text-credit" : tone === "debit" ? "text-debit" : "text-primary"}`}>{value}</span>
      {sub && <span className="text-xs text-neutral-500">{sub}</span>}
      {children}
    </div>
  );
}

function Card({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {note && <span className="text-xs text-neutral-500">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Heading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-1">
      <h2 className="text-lg font-semibold text-primary">{children}</h2>
      {note && <span className="text-xs text-neutral-500">{note}</span>}
    </div>
  );
}

function formatMetric(m: Metric): string {
  if (m.value == null) return "—";
  switch (m.format) {
    case "percent":
      return `${(m.value * 100).toFixed(1)}%`;
    case "money":
      return fmt(m.value);
    case "days":
      return `${Math.round(m.value)} days`;
    default:
      return m.value.toFixed(2);
  }
}

const STATUS_STYLE: Record<Exclude<MetricStatus, null>, { chip: string; text: string }> = {
  good: { chip: "bg-green-100 text-green-800", text: "Healthy" },
  watch: { chip: "bg-amber-100 text-amber-800", text: "Watch" },
  bad: { chip: "bg-red-100 text-red-800", text: "Needs attention" },
};

function MetricCard({ m }: { m: Metric }) {
  const status = m.status ? STATUS_STYLE[m.status] : null;
  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{m.label}</span>
          {status && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.chip}`}>{status.text}</span>}
        </div>
        <span className="text-xl font-semibold text-primary">{formatMetric(m)}</span>
        <span className="text-[11px] text-neutral-500 group-open:hidden">{m.value == null ? m.unavailable : "What does this mean?"}</span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-line p-3 text-xs">
        <p className="rounded bg-background px-2 py-1 font-mono text-[11px] text-neutral-700">{m.formula}</p>
        <p className="text-neutral-700">{m.explanation}</p>
        {m.value == null && m.unavailable && <p className="text-neutral-500">{m.unavailable}</p>}
      </div>
    </details>
  );
}

function BucketTable({ title, buckets }: { title: string; buckets: BucketTotal[] }) {
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);
  const totalAmount = buckets.reduce((s, b) => s + b.amount, 0);
  return (
    <Card title={title}>
      <BarChart
        categories={buckets.map((b) => b.bucket)}
        series={[{ key: "amount", label: "Outstanding", color: "var(--primary)" }]}
        data={buckets.map((b) => ({ amount: b.amount }))}
        money
        height={120}
      />
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line text-left font-semibold uppercase tracking-wide text-neutral-500">
            <th className="py-1">Age past due</th>
            <th className="py-1 text-right">#</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {buckets.map((b) => (
            <tr key={b.bucket}>
              <td className="py-1">{b.bucket}</td>
              <td className="py-1 text-right">{b.count}</td>
              <td className="py-1 text-right">{fmt(b.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-primary font-semibold">
            <td className="py-1">Total</td>
            <td className="py-1 text-right">{totalCount}</td>
            <td className="py-1 text-right">{fmt(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

function KeyTable({ title, k, partyLabel }: { title: string; k: KeyFigures; partyLabel: string }) {
  return (
    <Card title={title} note={partyLabel}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <th className="py-1" />
            <th className="py-1 text-right">#</th>
            <th className="py-1 text-right">Amount (incl. IVA)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          <tr>
            <td className="py-1.5">Invoiced</td>
            <td className="py-1.5 text-right">{k.count}</td>
            <td className="py-1.5 text-right">{fmt(k.gross)}</td>
          </tr>
          <tr>
            <td className="py-1.5">Paid</td>
            <td className="py-1.5 text-right">{k.paidCount}</td>
            <td className="py-1.5 text-right">{fmt(k.paid)}</td>
          </tr>
          <tr>
            <td className="py-1.5">Outstanding</td>
            <td className="py-1.5 text-right">{k.outstandingCount}</td>
            <td className="py-1.5 text-right">{fmt(k.outstanding)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="py-1.5">% outstanding</td>
            <td className="py-1.5 text-right">{k.count > 0 ? pct(k.outstandingCount / k.count) : "—"}</td>
            <td className="py-1.5 text-right">{pct(k.gross > 0.005 ? k.outstanding / k.gross : null)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

function TopList({ title, items, empty }: { title: string; items: Ranked[]; empty: string }) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-500">{empty}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line text-sm">
          {items.map((c, i) => (
            <li key={c.name} className="flex items-baseline gap-3 py-1.5">
              <span className="w-5 text-neutral-400">{i + 1}</span>
              <span className="flex-1 truncate" title={c.name}>
                {c.name}
              </span>
              <span className="font-medium">{fmt(c.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const effectiveYear = await getEffectiveReportingYear();
  const [d, labels] = await Promise.all([getDashboard(effectiveYear), getLabels()]);

  // For the current year only the months so far are drawn (later months have nothing yet).
  const monthsShown = d.reportingYear === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  const monthly = d.monthly.slice(0, monthsShown);
  const categories = monthly.map((m) => m.month);
  const s = d.statement;
  const overheadShare = s.revenue > 0.005 ? s.operatingCosts / s.revenue : null;
  const groups = ["Liquidity", "Profitability", "Efficiency", "Leverage", "Activity"] as const;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Dashboard</h1>
        <p className="text-sm text-neutral-600">
          Welcome, {session.name}. Reporting year {d.reportingYear}
          {d.asOf ? `, balances as at ${d.asOf}` : ", balances as of today"} &mdash; change the year from the nav.
        </p>
      </div>

      <BalanceWarningBanner diagnostics={d.diagnostics} />

      {/* ---------- Money position ---------- */}
      <section className="flex flex-col gap-3">
        <Heading>Money position</Heading>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Banks & cash" value={fmt(d.totalCash)} sub={`${d.banks.length} account${d.banks.length === 1 ? "" : "s"}`}>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-600">
              {d.banks.map((b) => (
                <li key={b.id} className="flex justify-between gap-2">
                  <span className="truncate">{b.name}</span>
                  <span>{fmt(b.balance)}</span>
                </li>
              ))}
            </ul>
          </StatCard>
          <StatCard
            label="Outstanding sales invoices"
            value={fmt(d.receivables.amount)}
            sub={`${d.receivables.count} invoices · overdue ${d.receivables.overdueCount} (${fmt(d.receivables.overdueAmount)})`}
            tone={d.receivables.overdueCount > 0 ? "credit" : undefined}
          />
          <StatCard
            label="Outstanding purchase invoices"
            value={fmt(d.payables.amount)}
            sub={`${d.payables.count} invoices · overdue ${d.payables.overdueCount} (${fmt(d.payables.overdueAmount)})`}
            tone={d.payables.overdueCount > 0 ? "credit" : undefined}
          />
          <StatCard label={`Cash flow ${d.reportingYear}`} value={fmt(d.cash.net)} tone={d.cash.net >= 0 ? "debit" : "credit"} sub="Money in less money out, transfers between accounts left out">
            <div className="mt-1 flex justify-between text-xs text-neutral-600">
              <span>In {fmt(d.cash.in)}</span>
              <span>Out {fmt(d.cash.out)}</span>
            </div>
          </StatCard>
        </div>
      </section>

      {/* ---------- Results ---------- */}
      <section className="flex flex-col gap-3">
        <Heading note="Same figures as Profit & Loss and the Income Statement">Results {d.reportingYear}</Heading>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Sales" value={fmt(s.revenue)} tone="debit" sub={`Gross profit ${fmt(s.grossProfit)} (${pct(s.revenue > 0.005 ? s.grossProfit / s.revenue : null)})`} />
          <StatCard label="Total costs" value={fmt(s.totalCosts)} tone="credit" sub={`${pct(s.revenue > 0.005 ? s.totalCosts / s.revenue : null)} of sales`} />
          <StatCard
            label="Operating costs"
            value={fmt(s.operatingCosts)}
            tone="credit"
            sub={`${pct(overheadShare)} of sales`}
          />
          <StatCard label="Result (net income)" value={fmt(s.netIncome)} tone={s.netIncome >= 0 ? "debit" : "credit"} sub={`Operating result ${fmt(s.operatingResult)}`} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Operating costs as a share of sales" note="Overheads %">
            <div className="flex items-center gap-4">
              <DonutChart value={overheadShare} color={COSTS_COLOR} />
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-2xl font-semibold text-primary">{fmt(s.operatingCosts)}</span>
                <span className="text-neutral-600">{pct(overheadShare)} of sales</span>
                <span className="text-xs text-neutral-500">Operating costs = overheads: everything except cost of sales, other expenses &amp; losses, and tax.</span>
              </div>
            </div>
          </Card>

          <Card title="Cost structure" className="md:col-span-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="py-1" />
                  <th className="py-1 text-right">Amount</th>
                  <th className="py-1 text-right">% of sales</th>
                  <th className="py-1 text-right">% of costs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.costShares.map((c, i) => (
                  <tr key={c.label} className={i === d.costShares.length - 1 ? "font-semibold" : c.label === "Operating costs" ? "bg-amber-50 font-medium" : ""}>
                    <td className="py-1.5">{c.label}</td>
                    <td className="py-1.5 text-right">{fmt(c.amount)}</td>
                    <td className="py-1.5 text-right">{pct(c.shareOfSales)}</td>
                    <td className="py-1.5 text-right">{pct(c.shareOfCosts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Operating costs by type" note="Amount and % of sales">
            <HBarChart items={d.operatingCostLines.map((l) => ({ label: l.label, value: l.value, share: l.share }))} color={COSTS_COLOR} />
          </Card>
          <Card title="By quarter">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="py-1" />
                  <th className="py-1 text-right">Sales</th>
                  <th className="py-1 text-right">Costs</th>
                  <th className="py-1 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.quarters.map((q) => (
                  <tr key={q.label}>
                    <td className="py-1.5">{q.label}</td>
                    <td className="py-1.5 text-right">{fmt(q.revenue)}</td>
                    <td className="py-1.5 text-right">{fmt(q.costs)}</td>
                    <td className={`py-1.5 text-right ${q.net < 0 ? "text-credit" : ""}`}>{fmt(q.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      {/* ---------- Charts ---------- */}
      <section className="flex flex-col gap-3">
        <Heading>Month by month</Heading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Sales & costs">
            <BarChart
              categories={categories}
              series={[
                { key: "sales", label: "Sales", color: SALES_COLOR },
                { key: "costs", label: "Costs", color: COSTS_COLOR },
              ]}
              data={monthly.map((m) => ({ sales: m.sales, costs: m.costs }))}
              money
            />
          </Card>
          <Card title="Result by month">
            <BarChart categories={categories} series={[{ key: "net", label: "Result", color: SALES_COLOR }]} data={monthly.map((m) => ({ net: m.net }))} money signed />
          </Card>
          <Card title="Year to date" note="Cumulative">
            <LineChart
              categories={categories}
              series={[
                { key: "cumSales", label: "Sales", color: SALES_COLOR },
                { key: "cumCosts", label: "Costs", color: COSTS_COLOR },
                { key: "cumNet", label: "Result", color: RESULT_COLOR, dashed: true },
              ]}
              data={monthly.map((m) => ({ cumSales: m.cumSales, cumCosts: m.cumCosts, cumNet: m.cumNet }))}
              money
            />
          </Card>
          <Card title="Money in and out" note="Transfers between accounts left out">
            <BarChart
              categories={categories}
              series={[
                { key: "cashIn", label: "In", color: SALES_COLOR },
                { key: "cashOut", label: "Out", color: COSTS_COLOR },
              ]}
              data={monthly.map((m) => ({ cashIn: m.cashIn, cashOut: m.cashOut }))}
              money
            />
          </Card>
          <Card title="Liquid assets" note="Month-end balance of all banks and cash" className="md:col-span-2">
            <LineChart categories={categories} series={[{ key: "balance", label: "Balance", color: SALES_COLOR }]} data={monthly.map((m) => ({ balance: m.balance }))} money />
          </Card>
        </div>
      </section>

      {/* ---------- Ageing ---------- */}
      <section className="flex flex-col gap-3">
        <Heading note="Past the due date (invoice date plus payment terms)">Ageing</Heading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BucketTable title="Sales invoices owed to us" buckets={d.receivablesByBucket} />
          <BucketTable title="Purchase invoices we owe" buckets={d.payablesByBucket} />
        </div>
      </section>

      {/* ---------- Key figures and IVA ---------- */}
      <section className="flex flex-col gap-3">
        <Heading>Key figures {d.reportingYear}</Heading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KeyTable title="Sales" k={d.keySales} partyLabel={`Invoices dated ${d.reportingYear}`} />
          <KeyTable title="Purchases" k={d.keyPurchases} partyLabel={`Invoices dated ${d.reportingYear}`} />
          <Card title="IVA" note={`${d.reportingYear}`}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-1.5">Tax on sales</td>
                  <td className="py-1.5 text-right">{fmt(d.vat.onSales)}</td>
                </tr>
                <tr>
                  <td className="py-1.5">Tax on purchases</td>
                  <td className="py-1.5 text-right">{fmt(d.vat.onPurchases)}</td>
                </tr>
                <tr className="font-medium">
                  <td className="py-1.5">IVA due (+) / in credit (−)</td>
                  <td className="py-1.5 text-right">{fmt(d.vat.due)}</td>
                </tr>
                <tr>
                  <td className="py-1.5">IVA paid / received</td>
                  <td className="py-1.5 text-right">{fmt(d.vat.paid)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-1.5">Balance</td>
                  <td className="py-1.5 text-right">{fmt(d.vat.balance)}</td>
                </tr>
              </tbody>
            </table>
            <Link href="/vat-report" className="text-xs text-primary hover:underline">
              Full IVA report &rarr;
            </Link>
          </Card>
        </div>
      </section>

      {/* ---------- Top 10 ---------- */}
      <section className="flex flex-col gap-3">
        <Heading note="Net of IVA, reporting year">Top 10</Heading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TopList title={`Best ${labels.client.toLowerCase()} (sales)`} items={d.topClients} empty="No sales yet this year." />
          <TopList title={`Best ${labels.project.toLowerCase()} (income less costs)`} items={d.topProjects} empty="Nothing booked to a project this year." />
          <TopList title="Biggest suppliers (spend)" items={d.topSuppliers} empty="No purchases yet this year." />
        </div>
      </section>

      {/* ---------- Financial metrics ---------- */}
      <section className="flex flex-col gap-3">
        <Heading note="Click a figure for how it is worked out and what it means">Financial metrics</Heading>
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{g}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {d.metrics
                .filter((m) => m.group === g)
                .map((m) => (
                  <MetricCard key={m.key} m={m} />
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
