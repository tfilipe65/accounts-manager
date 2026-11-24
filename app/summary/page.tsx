import { getDashboard } from "@/lib/actions/dashboard-actions";
import { getStatement } from "@/lib/actions/pl-actions";
import { getBalanceSheet, type BSLine } from "@/lib/actions/balance-sheet-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getCurrentCompany } from "@/lib/current-company";
import { buildRows, periodLabels } from "@/lib/pl-rows";
import { sum } from "@/lib/pl-structure";
import { formatMoney as fmt } from "@/lib/formatters";
import StatementTable from "@/components/StatementTable";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex break-inside-avoid flex-col gap-2">
      <h2 className="border-b border-line pb-1 text-lg font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Lines({ rows }: { rows: { label: string; value: string; bold?: boolean }[] }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.label} className={r.bold ? "font-semibold" : ""}>
            <td className="py-1.5">{r.label}</td>
            <td className="py-1.5 text-right">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BsColumn({ title, lines, total, totalLabel }: { title: string; lines: BSLine[]; total: number; totalLabel: string }) {
  return (
    <>
      <tr>
        <td className="pt-3 text-xs font-semibold uppercase tracking-wide text-neutral-600" colSpan={2}>
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.subgroup_no}>
          <td className="py-1 pl-4 text-neutral-700">{l.name}</td>
          <td className="py-1 text-right">{fmt(l.amount)}</td>
        </tr>
      ))}
      <tr className="border-t border-line font-semibold">
        <td className="py-1.5">{totalLabel}</td>
        <td className="py-1.5 text-right">{fmt(total)}</td>
      </tr>
    </>
  );
}

export default async function SummaryPage() {
  const year = await getEffectiveReportingYear();
  const [d, s, b, company] = await Promise.all([getDashboard(year), getStatement(year), getBalanceSheet(year), getCurrentCompany()]);
  const rows = buildRows(s, "quarters");
  const revenue = sum(s.revenue);
  const monthsShown = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  const monthSales = s.revenue.slice(0, monthsShown);
  const monthCosts = s.totalCosts.slice(0, monthsShown);
  const stat = (series: number[]) => ({ min: Math.min(...series), max: Math.max(...series), avg: series.reduce((a, c) => a + c, 0) / (series.length || 1) });
  const salesStat = stat(monthSales);
  const costStat = stat(monthCosts);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Summary {year}</h1>
          <p className="text-sm text-neutral-600">
            {company?.name ?? ""} &middot; the year at a glance{d.asOf ? `, balances as at ${d.asOf}` : ", balances as of today"}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Block title="Cash flow">
          <Lines
            rows={[
              { label: "Money in", value: fmt(d.cash.in) },
              { label: "Money out", value: fmt(d.cash.out) },
              { label: "Net cash flow", value: fmt(d.cash.net), bold: true },
              { label: "Balance at the start of the year", value: fmt(d.cash.opening) },
              { label: "Balance now", value: fmt(d.cash.closing), bold: true },
            ]}
          />
          <p className="text-xs text-neutral-500">Transfers between our own accounts are left out of money in and out.</p>
        </Block>

        <Block title="Liquid assets">
          <Lines rows={[...d.banks.map((x) => ({ label: x.name, value: fmt(x.balance) })), { label: "Total", value: fmt(d.totalCash), bold: true }]} />
        </Block>

        <Block title="Sales and costs">
          <Lines
            rows={[
              { label: "Sales", value: fmt(d.statement.revenue) },
              { label: "Total costs", value: fmt(d.statement.totalCosts) },
              { label: "Result", value: fmt(d.statement.netIncome), bold: true },
              { label: "Operating costs", value: `${fmt(d.statement.operatingCosts)} (${pct(revenue > 0.005 ? d.statement.operatingCosts / revenue : null)} of sales)` },
              { label: "Best month for sales / lowest / average", value: `${fmt(salesStat.max)} / ${fmt(salesStat.min)} / ${fmt(salesStat.avg)}` },
              { label: "Highest month for costs / lowest / average", value: `${fmt(costStat.max)} / ${fmt(costStat.min)} / ${fmt(costStat.avg)}` },
            ]}
          />
        </Block>

        <Block title="IVA">
          <Lines
            rows={[
              { label: "Tax on sales", value: fmt(d.vat.onSales) },
              { label: "Tax on purchases", value: fmt(d.vat.onPurchases) },
              { label: "IVA due (+) / in credit (−)", value: fmt(d.vat.due), bold: true },
              { label: "IVA paid / received", value: fmt(d.vat.paid) },
              { label: "Balance", value: fmt(d.vat.balance), bold: true },
            ]}
          />
        </Block>

        <Block title="Sales invoices">
          <Lines
            rows={[
              { label: "Invoiced (incl. IVA)", value: `${d.keySales.count} · ${fmt(d.keySales.gross)}` },
              { label: "Paid", value: `${d.keySales.paidCount} · ${fmt(d.keySales.paid)}` },
              { label: "Outstanding", value: `${d.keySales.outstandingCount} · ${fmt(d.keySales.outstanding)}`, bold: true },
              { label: "% outstanding", value: pct(d.keySales.gross > 0.005 ? d.keySales.outstanding / d.keySales.gross : null) },
            ]}
          />
        </Block>

        <Block title="Purchase invoices">
          <Lines
            rows={[
              { label: "Invoiced (incl. IVA)", value: `${d.keyPurchases.count} · ${fmt(d.keyPurchases.gross)}` },
              { label: "Paid", value: `${d.keyPurchases.paidCount} · ${fmt(d.keyPurchases.paid)}` },
              { label: "Outstanding", value: `${d.keyPurchases.outstandingCount} · ${fmt(d.keyPurchases.outstanding)}`, bold: true },
              { label: "% outstanding", value: pct(d.keyPurchases.gross > 0.005 ? d.keyPurchases.outstanding / d.keyPurchases.gross : null) },
            ]}
          />
        </Block>
      </div>

      <Block title={`Profit & Loss ${year}`}>
        <StatementTable columns={periodLabels("quarters")} rows={rows} revenueTotal={revenue} compact />
      </Block>

      <Block title="Balance Sheet">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <table className="w-full text-sm">
            <tbody>
              <BsColumn title="Current assets" lines={b.currentAssets} total={b.totalCurrentAssets} totalLabel="Total current assets" />
              <BsColumn title="Non-current assets" lines={b.nonCurrentAssets} total={b.totalNonCurrentAssets} totalLabel="Total non-current assets" />
              <tr className="border-t-2 border-primary text-base font-semibold text-primary">
                <td className="py-2">Total assets</td>
                <td className="py-2 text-right">{fmt(b.totalAssets)}</td>
              </tr>
            </tbody>
          </table>
          <table className="w-full text-sm">
            <tbody>
              <BsColumn title="Liabilities" lines={b.liabilities} total={b.totalLiabilities} totalLabel="Total liabilities" />
              <BsColumn title="Long-term debt" lines={b.longTermDebt} total={b.totalLongTermDebt} totalLabel="Total long-term debt" />
              <tr>
                <td className="pt-3 text-xs font-semibold uppercase tracking-wide text-neutral-600" colSpan={2}>
                  Equity
                </td>
              </tr>
              {b.equity.map((l) => (
                <tr key={l.subgroup_no}>
                  <td className="py-1 pl-4 text-neutral-700">{l.name}</td>
                  <td className="py-1 text-right">{fmt(l.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1 pl-4 text-neutral-700">Profit kept from earlier years</td>
                <td className="py-1 text-right">{fmt(b.retainedPriorYears)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-neutral-700">Result of {year}</td>
                <td className="py-1 text-right">{fmt(b.resultOfYear)}</td>
              </tr>
              <tr className="border-t-2 border-primary text-base font-semibold text-primary">
                <td className="py-2">Total liabilities and equity</td>
                <td className="py-2 text-right">{fmt(b.totalLiabilitiesAndEquity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Block>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {[
          { title: "Ageing: sales invoices owed to us", buckets: d.receivablesByBucket },
          { title: "Ageing: purchase invoices we owe", buckets: d.payablesByBucket },
        ].map((a) => (
          <Block key={a.title} title={a.title}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="py-1">Past due</th>
                  <th className="py-1 text-right">#</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {a.buckets.map((x) => (
                  <tr key={x.bucket}>
                    <td className="py-1">{x.bucket}</td>
                    <td className="py-1 text-right">{x.count}</td>
                    <td className="py-1 text-right">{fmt(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        ))}
      </div>
    </div>
  );
}
