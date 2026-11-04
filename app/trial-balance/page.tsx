import { Fragment } from "react";
import { getTrialBalance } from "@/lib/actions/trial-balance-actions";
import { getBalanceDiagnostics } from "@/lib/actions/balance-diagnostics-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { reportingYearCutoffDate } from "@/lib/reporting-year-utils";
import { formatMoney as fmt } from "@/lib/formatters";
import BalanceWarningBanner from "@/components/BalanceWarningBanner";

export default async function TrialBalancePage() {
  const year = await getEffectiveReportingYear();
  const cutoff = reportingYearCutoffDate(year);
  const [{ rows, totalDebit, totalCredit }, diagnostics] = await Promise.all([
    getTrialBalance(cutoff ?? undefined),
    getBalanceDiagnostics(),
  ]);
  const outOfBalance = Math.abs(totalDebit - totalCredit) > 0.005;

  const byGroup = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byGroup.has(r.group_name)) byGroup.set(r.group_name, []);
    byGroup.get(r.group_name)!.push(r);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Trial Balance</h1>
          <p className="text-sm text-neutral-600">{cutoff ? `As of ${cutoff} (end of ${year})` : "As of today"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${outOfBalance ? "bg-credit/10 text-credit" : "bg-debit/10 text-debit"}`}>
          {outOfBalance ? `Out of balance by ${fmt(totalDebit - totalCredit)}` : "Balanced"}
        </span>
      </div>

      <BalanceWarningBanner diagnostics={diagnostics} />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(byGroup.entries()).map(([groupName, groupRows]) => (
              <Fragment key={groupName}>
                <tr className="bg-background">
                  <td className="px-4 py-1.5 font-semibold text-primary" colSpan={3}>
                    {groupName}
                  </td>
                </tr>
                {groupRows.map((r) => (
                  <tr key={r.account_no} className="border-b border-line hover:bg-background">
                    <td className="px-4 py-2">
                      {r.account_no} {r.account_name}
                    </td>
                    <td className="px-4 py-2 text-right">{r.debit > 0 ? fmt(r.debit) : ""}</td>
                    <td className="px-4 py-2 text-right">{r.credit > 0 ? fmt(r.credit) : ""}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right">{fmt(totalDebit)}</td>
              <td className="px-4 py-2 text-right">{fmt(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
