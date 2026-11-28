import Link from "next/link";
import { listJournalEntries } from "@/lib/actions/journal-actions";
import { createJournalEntryFormAction, deleteJournalEntryAction, deleteJournalGroupAction } from "@/lib/actions/journal-form-actions";
import { listAllAccountOptions } from "@/lib/actions/reference-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";
import JournalEntryForm from "@/components/JournalEntryForm";
import RegisterBalanceNotice from "@/components/RegisterBalanceNotice";
import { getRegisterDiffs } from "@/lib/actions/balance-diagnostics-actions";

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const year = await getEffectiveReportingYear();
  const [entries, accounts, closedThroughYear, { journalDiff }] = await Promise.all([
    listJournalEntries(showAll ? undefined : year),
    listAllAccountOptions(),
    getClosedThroughYear(),
    getRegisterDiffs(),
  ]);
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Journal Entries</h1>
        <Link href={showAll ? "/journal" : "/journal?all=1"} className="text-sm text-primary hover:underline">
          {showAll ? `Show ${year} only` : "Show all years"}
        </Link>
      </div>

      <RegisterBalanceNotice kind="journal" diff={journalDiff} />

      <JournalEntryForm accounts={accounts} action={createJournalEntryFormAction} closedThroughYear={closedThroughYear} registerDiff={journalDiff} />

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
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-background">
                <td className="px-4 py-2">{formatDate(e.date)}</td>
                <td className="px-4 py-2">
                  {e.account_no} {e.account_name}
                </td>
                <td className="px-4 py-2">
                  {e.description}
                  {e.entry_id && !e.employee_id && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">multi-line entry</span>}
                </td>
                <td className="px-4 py-2 text-right">{e.debit > 0 ? fmt(e.debit) : ""}</td>
                <td className="px-4 py-2 text-right">{e.credit > 0 ? fmt(e.credit) : ""}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {e.entry_id && !e.employee_id ? (
                      <>
                        <Link href={`/journal/entry/${e.entry_id}`} className="text-xs text-primary hover:underline">
                          Edit entry
                        </Link>
                        <form action={deleteJournalGroupAction.bind(null, e.entry_id)}>
                          <button type="submit" title="Deletes every line of this entry" className="text-xs text-neutral-500 hover:text-red-700">
                            Delete entry
                          </button>
                        </form>
                      </>
                    ) : (
                      <>
                        <Link href={`/journal/${e.id}`} className="text-xs text-primary hover:underline">
                          Edit
                        </Link>
                        <form action={deleteJournalEntryAction.bind(null, e.id)}>
                          <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                            Delete
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t border-line bg-background font-semibold">
                <td className="px-4 py-2" colSpan={3}>
                  Total
                </td>
                <td className={`px-4 py-2 text-right ${Math.abs(totalDebit - totalCredit) > 0.005 ? "text-credit" : ""}`}>{fmt(totalDebit)}</td>
                <td className={`px-4 py-2 text-right ${Math.abs(totalDebit - totalCredit) > 0.005 ? "text-credit" : ""}`}>{fmt(totalCredit)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
