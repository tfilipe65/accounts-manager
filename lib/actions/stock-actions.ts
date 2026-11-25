"use server";

// Year-end stock. Materials bought during the year go straight to cost of sales; at the end of the year the
// stock still on the shelves is counted and valued, and this posts the adjustment that takes it out of the year's
// costs and shows it as an asset:
//
//   31 Dec   Dr Stock            Cr Change in stock      (the amount that brings the stock account to the counted value)
//   1 Jan    Dr Change in stock  Cr Stock                (the same entry reversed, so next year starts clean)
//
// Posted as ordinary journal entries (so every report sees them), tagged by their description so a count can be
// replaced or removed later. The change-in-stock account is a cost-of-sales account with the role stock_change;
// a company on the old chart gets one created the first time.

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";
import { getTrialBalance } from "@/lib/actions/trial-balance-actions";

const PREFIX = "Year-end stock count";
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const countLabel = (year: number) => `${PREFIX} ${year}`;
const reversalLabel = (year: number) => `${PREFIX} ${year} (reversal)`;

async function stockAccount(): Promise<{ account_no: number; name: string } | null> {
  return queryOne<{ account_no: number; name: string }>(
    `SELECT a.account_no, a.name FROM accounts a JOIN account_subgroups s ON s.subgroup_no = a.subgroup_no
     WHERE s.role = 'inventory' ORDER BY a.account_no LIMIT 1`
  );
}

export type StockCount = { year: number; value: number; adjustment: number; postedOn: string; reversedOn: string };

export type YearEndStockPage = {
  stock: { account_no: number; name: string } | null;
  /** What the stock account shows at the end of each year, before any count made here. */
  baselineByYear: Record<number, number>;
  counts: StockCount[];
};

/** What the stock account holds at 31 Dec of the year, leaving out the entries this page posts. */
async function baseline(stockNo: number, year: number): Promise<number> {
  const tb = await getTrialBalance(`${year}-12-31`);
  const row = tb.rows.find((r) => r.account_no === stockNo);
  const shown = row ? row.debit - row.credit : 0;
  const mine = await queryOne<{ net: string }>(
    "SELECT COALESCE(SUM(debit - credit), 0) AS net FROM journal_entries WHERE account_no = $1 AND description LIKE $2 AND date <= $3",
    [stockNo, `${PREFIX}%`, `${year}-12-31`]
  );
  return r2(shown - Number(mine?.net ?? 0));
}

export async function getYearEndStockPage(years: number[]): Promise<YearEndStockPage> {
  await requireSession();
  const stock = await stockAccount();
  if (!stock) return { stock: null, baselineByYear: {}, counts: [] };
  const baselineByYear: Record<number, number> = {};
  for (const y of years) baselineByYear[y] = await baseline(stock.account_no, y);
  const rows = await query<{ description: string; date: string; net: string }>(
    `SELECT description, MIN(date)::text AS date, SUM(debit - credit) AS net
     FROM journal_entries WHERE account_no = $1 AND description LIKE $2 GROUP BY description ORDER BY description`,
    [stock.account_no, `${PREFIX} %`]
  );
  const byYear = new Map<number, { adj: number; posted: string; reversed: string }>();
  for (const r of rows) {
    const m = r.description.match(/^Year-end stock count (\d{4})( \(reversal\))?$/);
    if (!m) continue;
    const y = Number(m[1]);
    const e = byYear.get(y) ?? { adj: 0, posted: "", reversed: "" };
    if (m[2]) e.reversed = r.date;
    else {
      e.adj = Number(r.net);
      e.posted = r.date;
    }
    byYear.set(y, e);
  }
  const counts: StockCount[] = [];
  for (const [year, e] of byYear) {
    if (!e.posted) continue;
    const base = await baseline(stock.account_no, year);
    counts.push({ year, value: r2(base + e.adj), adjustment: e.adj, postedOn: e.posted, reversedOn: e.reversed });
  }
  counts.sort((a, b) => b.year - a.year);
  return { stock, baselineByYear, counts };
}

type Tx = { query: <T = unknown>(sql: string, p?: unknown[]) => Promise<{ rows: T[] }> };

/** The cost-of-sales account the adjustment is set against; made on the spot when the chart has none. */
async function changeInStockAccount(tx: Tx): Promise<number> {
  const have = (await tx.query<{ account_no: number }>("SELECT account_no FROM accounts WHERE role = 'stock_change' ORDER BY account_no LIMIT 1")).rows[0];
  if (have) return have.account_no;
  const sub = (await tx.query<{ subgroup_no: number }>("SELECT subgroup_no FROM account_subgroups WHERE role = 'cost_materials' ORDER BY subgroup_no LIMIT 1")).rows[0];
  if (!sub) throw new Error('The chart of accounts has no cost-of-sales materials group to put "Change in stock" in. Add the account yourself and give it the role "stock_change".');
  const next = (await tx.query<{ n: number }>("SELECT COALESCE(MAX(account_no), 0) + 1 AS n FROM accounts WHERE subgroup_no = $1", [sub.subgroup_no])).rows[0].n;
  await tx.query("INSERT INTO accounts (account_no, name, subgroup_no, role) VALUES ($1, 'Change in stock (year-end count)', $2, 'stock_change')", [next, sub.subgroup_no]);
  return next;
}

export async function postYearEndStock(input: { year: number; value: number }): Promise<void> {
  const session = await requireSession();
  const { year } = input;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Choose the year of the count.");
  if (!Number.isFinite(input.value) || input.value < 0) throw new Error("Enter the value of the stock counted (zero or more).");
  const stock = await stockAccount();
  if (!stock) throw new Error("This company has no stock account.");
  await assertYearOpen(`${year}-12-31`, session);
  await assertYearOpen(`${year + 1}-01-01`, session);

  const adjustment = r2(input.value - (await baseline(stock.account_no, year)));
  if (Math.abs(adjustment) < 0.005) throw new Error("Nothing to post: the stock account already shows that value.");
  const amount = Math.abs(adjustment);

  await withTransaction(async (tx) => {
    const t = tx as unknown as Tx;
    const change = await changeInStockAccount(t);
    await t.query("DELETE FROM journal_entries WHERE description IN ($1, $2)", [countLabel(year), reversalLabel(year)]);
    const post = async (date: string, label: string, stockDebit: boolean) => {
      const entry = crypto.randomUUID();
      const line = (account: number, debit: number, credit: number) =>
        t.query("INSERT INTO journal_entries (date, account_no, description, debit, credit, entry_id) VALUES ($1,$2,$3,$4,$5,$6)", [date, account, label, debit, credit, entry]);
      await line(stock.account_no, stockDebit ? amount : 0, stockDebit ? 0 : amount);
      await line(change, stockDebit ? 0 : amount, stockDebit ? amount : 0);
    };
    await post(`${year}-12-31`, countLabel(year), adjustment > 0);
    await post(`${year + 1}-01-01`, reversalLabel(year), adjustment < 0);
  });
  refresh();
}

export async function deleteYearEndStock(year: number): Promise<void> {
  const session = await requireSession();
  await assertYearOpen(`${year}-12-31`, session);
  await assertYearOpen(`${year + 1}-01-01`, session);
  await query("DELETE FROM journal_entries WHERE description IN ($1, $2)", [countLabel(year), reversalLabel(year)]);
  refresh();
}

function refresh() {
  for (const p of ["/year-end-stock", "/journal", "/balance-sheet", "/profit-and-loss", "/income-statement", "/trial-balance", "/"]) revalidatePath(p);
}
