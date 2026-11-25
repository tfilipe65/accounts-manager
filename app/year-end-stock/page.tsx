import { getYearEndStockPage } from "@/lib/actions/stock-actions";
import { deleteYearEndStockAction } from "@/lib/actions/stock-form-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";
import YearEndStockForm from "@/components/YearEndStockForm";

export default async function YearEndStockPage() {
  const year = await getEffectiveReportingYear();
  const years = [year - 2, year - 1, year, year + 1];
  const [page, closedThroughYear] = await Promise.all([getYearEndStockPage(years), getClosedThroughYear()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Year-End Stock</h1>

      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-neutral-700">
        <p className="font-semibold text-neutral-800">How stock works here</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>During the year, materials you buy go straight to cost of sales. The stock account does not move.</li>
          <li>At 31 December, count what is on the shelves and value it at cost. Enter that value below.</li>
          <li>
            The app posts one entry that lifts the stock account to the value counted and lowers cost of sales by the same amount, so profit
            only carries what you actually used. The stock shows on the balance sheet as an asset.
          </li>
          <li>On 1 January the entry is reversed, so the new year starts clean and the next count works the same way.</li>
        </ol>
      </div>

      {!page.stock ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-neutral-600">This company has no stock account, so there is nothing to count.</p>
      ) : (
        <>
          <YearEndStockForm years={years} defaultYear={year} baselineByYear={page.baselineByYear} closedThroughYear={closedThroughYear} />

          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2">Count at</th>
                  <th className="px-4 py-2 text-right">Value counted</th>
                  <th className="px-4 py-2 text-right">Adjustment posted</th>
                  <th className="px-4 py-2">Reversed on</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {page.counts.map((c) => (
                  <tr key={c.year} className="hover:bg-background">
                    <td className="px-4 py-2 font-medium">{formatDate(c.postedOn)}</td>
                    <td className="px-4 py-2 text-right">{fmt(c.value)}</td>
                    <td className="px-4 py-2 text-right">{fmt(c.adjustment)}</td>
                    <td className="px-4 py-2">{c.reversedOn ? formatDate(c.reversedOn) : ""}</td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteYearEndStockAction.bind(null, c.year)}>
                        <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {page.counts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      No stock counts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            Stock account: {page.stock.account_no} {page.stock.name}. The entries are ordinary journal entries, so you can see them on the Journal Entries page.
          </p>
        </>
      )}
    </div>
  );
}
