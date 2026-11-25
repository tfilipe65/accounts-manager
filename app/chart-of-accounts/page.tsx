import { query } from "@/lib/db";
import { listSubgroupOptions } from "@/lib/actions/account-actions";
import AccountDialogButton from "@/components/AccountDialog";
import { deleteAccountAction } from "@/lib/actions/account-form-actions";
import { getTrialBalance } from "@/lib/actions/trial-balance-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { reportingYearCutoffDate } from "@/lib/reporting-year-utils";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";

type AccountRow = {
  account_no: number;
  name: string;
  is_reserved: boolean;
  subgroup_no: number;
  subgroup_name: string;
  normal_balance: "debit" | "credit";
  group_no: number;
  group_name: string;
  statement: "P&L" | "Balance Sheet";
};

async function getAccounts(): Promise<AccountRow[]> {
  return query<AccountRow>(`
    SELECT a.account_no, a.name, a.is_reserved,
           sg.subgroup_no, sg.name AS subgroup_name, sg.normal_balance,
           g.group_no, g.name AS group_name, g.statement
    FROM accounts a
    JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
    JOIN account_groups g ON g.group_no = sg.group_no
    ORDER BY g.group_no, sg.subgroup_no, a.account_no
  `);
}

export default async function ChartOfAccountsPage() {
  const year = await getEffectiveReportingYear();
  const cutoff = reportingYearCutoffDate(year);
  const [accounts, subgroups, now, before] = await Promise.all([
    getAccounts(),
    listSubgroupOptions(),
    getTrialBalance(cutoff ?? undefined),
    getTrialBalance(`${year - 1}-12-31`),
  ]);
  // The balance of each account, the way QuickBooks shows it next to the chart. Balance sheet accounts: what they hold at
  // the end of the reporting year (today for the current year). Income and cost accounts: the year's total, so they start
  // from zero each year. Shown in the account's own direction (assets and costs by debit, the rest by credit).
  const nowBy = new Map(now.rows.map((r) => [r.account_no, r.debit - r.credit]));
  const beforeBy = new Map(before.rows.map((r) => [r.account_no, r.debit - r.credit]));
  const balanceOf = (a: AccountRow) => {
    let net = nowBy.get(a.account_no) ?? 0;
    if (a.statement === "P&L") net -= beforeBy.get(a.account_no) ?? 0;
    return a.normal_balance === "debit" ? net : -net;
  };
  const money = (n: number) => (Math.abs(n) < 0.005 ? <span className="text-neutral-300">&ndash;</span> : fmt(n));

  const byGroup = new Map<string, { group: AccountRow; bySubgroup: Map<number, AccountRow[]> }>();
  for (const a of accounts) {
    const gKey = `${a.group_no}`;
    if (!byGroup.has(gKey)) byGroup.set(gKey, { group: a, bySubgroup: new Map() });
    const entry = byGroup.get(gKey)!;
    if (!entry.bySubgroup.has(a.subgroup_no)) entry.bySubgroup.set(a.subgroup_no, []);
    entry.bySubgroup.get(a.subgroup_no)!.push(a);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Chart of Accounts</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600">{accounts.length} accounts</span>
          <AccountDialogButton
            subgroups={subgroups}
            label="+ New account"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          />
        </div>
      </div>

      <p className="-mt-3 text-xs text-neutral-500">
        Balances {cutoff ? `at ${formatDate(cutoff)}` : "as of today"} for balance sheet accounts; income and cost accounts show the {year} total.
        Change the year in the menu bar.
      </p>

      <div className="flex flex-col gap-6">
        {Array.from(byGroup.values()).map(({ group, bySubgroup }) => (
          <section key={group.group_no} className="rounded-lg border border-line bg-surface">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-semibold text-primary">
                {group.group_no}. {group.group_name}
              </h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {group.statement}
              </span>
            </header>
            <div className="divide-y divide-line">
              {Array.from(bySubgroup.entries()).map(([subgroupNo, rows]) => (
                <div key={subgroupNo} className="px-4 py-3">
                  <h3 className="mb-2 flex items-baseline justify-between text-sm font-semibold text-neutral-700">
                    <span>
                      {subgroupNo} &middot; {rows[0].subgroup_name}{" "}
                      <span className="font-normal text-neutral-400">
                        ({rows[0].normal_balance === "debit" ? "Debit-normal" : "Credit-normal"})
                      </span>
                    </span>
                    <span className="pr-[8.5rem] font-mono text-sm">{money(rows.reduce((s, a) => s + balanceOf(a), 0))}</span>
                  </h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.map((a) => (
                        <tr key={a.account_no} className="hover:bg-background">
                          <td className="w-20 py-1 font-mono text-neutral-500">{a.account_no}</td>
                          <td className="py-1">{a.name}</td>
                          <td className="w-24 py-1 text-right">
                            {a.is_reserved && (
                              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">reserved</span>
                            )}
                          </td>
                          <td className="w-32 py-1 pr-4 text-right font-mono text-neutral-700">{money(balanceOf(a))}</td>
                          <td className="w-28 py-1 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <AccountDialogButton
                                subgroups={subgroups}
                                account={{ account_no: a.account_no, name: a.name, subgroup_no: a.subgroup_no, is_reserved: a.is_reserved }}
                                label="Edit"
                                className="text-xs text-primary hover:underline"
                              />
                              <form action={deleteAccountAction.bind(null, a.account_no)}>
                                <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                                  Delete
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
