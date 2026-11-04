import Link from "next/link";
import { listOpeningBalances } from "@/lib/actions/opening-balance-actions";
import { createOpeningBalanceFormAction, deleteOpeningBalanceAction } from "@/lib/actions/opening-balance-form-actions";
import { listAllAccountOptions } from "@/lib/actions/reference-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";
import OpeningBalanceForm from "@/components/OpeningBalanceForm";

export default async function OpeningBalancePage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const year = await getEffectiveReportingYear();
  const [rows, accounts, closedThroughYear] = await Promise.all([
    listOpeningBalances(showAll ? undefined : year),
    listAllAccountOptions(),
    getClosedThroughYear(),
  ]);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Opening Balance</h1>
          <Link href={showAll ? "/opening-balance" : "/opening-balance?all=1"} className="text-sm text-primary hover:underline">
            {showAll ? `Show ${year} only` : "Show all years"}
          </Link>
        </div>
        <span className={`text-sm ${Math.abs(totalDebit - totalCredit) > 0.005 ? "font-semibold text-credit" : "text-neutral-600"}`}>
          {Math.abs(totalDebit - totalCredit) > 0.005 ? `Out of balance by ${fmt(totalDebit - totalCredit)}` : "Balanced"}
        </span>
      </div>

      <OpeningBalanceForm accounts={accounts} action={createOpeningBalanceFormAction} closedThroughYear={closedThroughYear} />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-background">
                <td className="px-4 py-2">{formatDate(r.date)}</td>
                <td className="px-4 py-2">
                  {r.account_no} {r.account_name}
                </td>
                <td className="px-4 py-2">{r.description}</td>
                <td className="px-4 py-2 text-right">{r.debit > 0 ? fmt(r.debit) : ""}</td>
                <td className="px-4 py-2 text-right">{r.credit > 0 ? fmt(r.credit) : ""}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/opening-balance/${r.id}`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                    <form action={deleteOpeningBalanceAction.bind(null, r.id)}>
                      <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-line bg-background font-semibold">
                <td className="px-4 py-2" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-2 text-right">{fmt(totalDebit)}</td>
                <td className="px-4 py-2 text-right">{fmt(totalCredit)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
