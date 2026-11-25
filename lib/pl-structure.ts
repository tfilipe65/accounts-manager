// The one Profit & Loss structure every page uses (P&L, Income Statement, Dashboard), so the same
// year can never show two different "Sales", "Costs" or "Result".
//
// Found by the role of each subgroup (lib/roles.ts), not by number:
//   Revenue                        role revenue
//   - Cost of sales                group 2
//   = Gross profit
//   - Operating expenses           group 3, except other_expense
//   = Operating result
//   + Other income & gains         roles other_income and interest_income
//   - Other expenses & losses      roles other_expense and interest_expense
//   = Income before tax
//   - Income tax                   role income_tax
//   = Net income
//
// Plain functions only (no server actions), so server and client code can both import them.

const ROLES = {
  revenue: ["revenue"],
  otherIncome: ["other_income", "interest_income"],
  otherExpenses: ["other_expense", "interest_expense"],
  incomeTax: ["income_tax"],
} as const;
const hasRole = (l: { role: string | null }, roles: readonly string[]) => l.role != null && roles.includes(l.role);

export type Series = number[]; // twelve months, January first

/** One subgroup's monthly net as (debit - credit), straight from the ledger. */
export type MonthlyLine = { subgroup_no: number; subgroup_name: string; group_no: number; role: string | null; net: Series };

export type PLLine = { subgroup_no: number; name: string; months: Series; total: number };

export type PLStatement = {
  year: number;
  revenue: Series;
  costOfSales: Series;
  grossProfit: Series;
  operatingExpenseLines: PLLine[];
  operatingExpenses: Series;
  operatingResult: Series;
  otherIncome: Series;
  otherExpenseLines: PLLine[];
  otherExpenses: Series;
  incomeBeforeTax: Series;
  incomeTax: Series;
  netIncome: Series;
  totalIncome: Series; // revenue + other income
  totalCosts: Series; // everything charged against income, tax included
};

export const zeros = (): Series => Array.from({ length: 12 }, () => 0);
export const sum = (s: Series): number => s.reduce((a, b) => a + b, 0);
export const add = (...all: Series[]): Series => zeros().map((_, i) => all.reduce((t, s) => t + (s[i] ?? 0), 0));
export const sub = (a: Series, b: Series): Series => a.map((v, i) => v - (b[i] ?? 0));
export const neg = (s: Series): Series => s.map((v) => -v);

/** Months 1-3, 4-6 ... for quarter 1-4. */
export const quarter = (s: Series, q: number): number => s.slice((q - 1) * 3, q * 3).reduce((a, b) => a + b, 0);

export function buildStatement(year: number, lines: MonthlyLine[]): PLStatement {
  const income = (roles: readonly string[]) => neg(lines.filter((l) => hasRole(l, roles)).reduce((acc, l) => add(acc, l.net), zeros()));
  const costOf = (pick: (l: MonthlyLine) => boolean) => lines.filter(pick).reduce((acc, l) => add(acc, l.net), zeros());
  const toLine = (l: MonthlyLine): PLLine => ({ subgroup_no: l.subgroup_no, name: l.subgroup_name, months: l.net, total: sum(l.net) });
  const isOpex = (l: MonthlyLine) => l.group_no === 3 && !hasRole(l, ROLES.otherExpenses) && !hasRole(l, ROLES.incomeTax);
  const isOtherExpense = (l: MonthlyLine) => hasRole(l, ROLES.otherExpenses);

  const revenue = income(ROLES.revenue);
  const otherIncome = income(ROLES.otherIncome);
  const costOfSales = costOf((l) => l.group_no === 2);
  const operatingExpenses = costOf(isOpex);
  const otherExpenses = costOf(isOtherExpense);
  const incomeTax = costOf((l) => hasRole(l, ROLES.incomeTax));

  const grossProfit = sub(revenue, costOfSales);
  const operatingResult = sub(grossProfit, operatingExpenses);
  const incomeBeforeTax = sub(add(operatingResult, otherIncome), otherExpenses);

  return {
    year,
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenseLines: lines.filter(isOpex).map(toLine).filter((l) => Math.abs(l.total) > 0.005).sort((a, b) => b.total - a.total),
    operatingExpenses,
    operatingResult,
    otherIncome,
    otherExpenseLines: lines.filter(isOtherExpense).map(toLine).filter((l) => Math.abs(l.total) > 0.005),
    otherExpenses,
    incomeBeforeTax,
    incomeTax,
    netIncome: sub(incomeBeforeTax, incomeTax),
    totalIncome: add(revenue, otherIncome),
    totalCosts: add(costOfSales, operatingExpenses, otherExpenses, incomeTax),
  };
}
