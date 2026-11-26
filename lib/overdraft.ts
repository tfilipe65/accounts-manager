// A bank account cannot be taken below zero, with one exception: the main current account (the first bank account)
// may go as far below zero as the overdraft recorded in Settings. Petty cash and every other account never can.
//
// The rule is checked after every write that moves money in or out of an account, inside the same transaction, so a
// refused entry leaves nothing behind. It looks at the balance at the end of every day (so a back-dated payment, an edit,
// or deleting a deposit that paid for later payments is caught too). An account that was already below its limit
// before the entry is not blocked from unrelated changes: only a day that this entry makes lower is refused.

import { withTransaction, type Queryable } from "@/lib/db";
import { formatMoney } from "@/lib/formatters";

type Point = { date: string; balance: number };

/** The account's balance at the end of every day on which something happened. */
async function dailyBalances(client: Queryable, bankAccountId: number): Promise<Point[]> {
  const rows = (
    await client.query<{ bal: string; d: string }>(
      `WITH ev AS (
         SELECT date AS d, SUM(debit - credit) AS amt FROM opening_balances
          WHERE account_no = (SELECT account_no FROM bank_accounts WHERE id = $1) GROUP BY date
         UNION ALL
         SELECT payment_date AS d, SUM(in_amount + in_vat - out_amount - out_vat) AS amt FROM bank_transactions
          WHERE bank_account_id = $1 GROUP BY payment_date
       ), daily AS (SELECT d, SUM(amt) AS amt FROM ev GROUP BY d)
       SELECT d, SUM(amt) OVER (ORDER BY d) AS bal FROM daily ORDER BY d`,
      [bankAccountId]
    )
  ).rows;
  return rows.map((r) => ({ date: String(r.d).slice(0, 10), balance: Number(r.bal) }));
}

/** Balance at the end of `date` (it carries on from the last day with activity). */
function balanceOn(series: Point[], date: string): number {
  let value = 0;
  for (const p of series) {
    if (p.date > date) break;
    value = p.balance;
  }
  return value;
}

export async function guardOverdraft<T>(client: Queryable, bankAccountIds: (number | null | undefined)[], run: () => Promise<T>): Promise<T> {
  const ids = Array.from(new Set(bankAccountIds.filter((x): x is number => x != null)));
  const before = new Map<number, Point[]>();
  for (const id of ids) before.set(id, await dailyBalances(client, id));
  const result = await run();
  if (ids.length === 0) return result;

  const main = (await client.query<{ id: number }>("SELECT id FROM bank_accounts WHERE NOT is_cash ORDER BY id LIMIT 1")).rows[0]?.id ?? null;
  const limit = Number((await client.query<{ overdraft_limit: string }>("SELECT overdraft_limit FROM app_settings WHERE id = 1")).rows[0]?.overdraft_limit ?? 0);
  for (const id of ids) {
    const after = await dailyBalances(client, id);
    const was = before.get(id)!;
    const allowed = id === main ? limit : 0;
    // A day is a problem when the balance is past the limit AND this entry made that day lower than it was.
    let worst: Point | null = null;
    for (const p of after) {
      if (p.balance < -allowed - 0.005 && p.balance < balanceOn(was, p.date) - 0.005 && (!worst || p.balance < worst.balance)) worst = p;
    }
    if (!worst) continue;
    const acct = (await client.query<{ name: string; is_cash: boolean }>("SELECT name, is_cash FROM bank_accounts WHERE id = $1", [id])).rows[0];
    const name = acct?.name ?? "This account";
    const reached = `This would take it to ${formatMoney(worst.balance)} on ${worst.date.split("-").reverse().join("/")}.`;
    if (acct?.is_cash) throw new Error(`${name} is a cash box and can never go below zero. ${reached}`);
    if (id === main && allowed > 0) {
      throw new Error(`${name} would go further below zero than the overdraft you allow (${formatMoney(allowed)}, set in Settings). ${reached}`);
    }
    throw new Error(`${name} cannot go below zero${id === main ? " (no overdraft is set in Settings)" : ""}. ${reached}`);
  }
  return result;
}

/** Run a write inside one transaction and refuse it if it overdraws any of these bank accounts. */
export function withOverdraftGuard<T>(bankAccountIds: (number | null | undefined)[], fn: (client: Queryable) => Promise<T>): Promise<T> {
  return withTransaction((client) => guardOverdraft(client, bankAccountIds, () => fn(client)));
}
