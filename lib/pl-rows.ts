// Turns the P&L structure into display rows (shared by the Profit & Loss, Income Statement and Summary
// pages, so they cannot drift apart). Each row has one cell per period plus a total for the year.

import { quarter, sum, type PLStatement, type Series } from "./pl-structure";

export type StatementRow = {
  key: string;
  label: string;
  cells: number[];
  total: number;
  /** Subtotals are drawn bold with a rule above. */
  kind: "line" | "subtotal" | "total";
  indent?: boolean;
  /** A cost line: shown in brackets so the reader can see it is taken away. */
  cost?: boolean;
};

export type Periods = "months" | "quarters";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodLabels(p: Periods): string[] {
  return p === "months" ? MONTHS : ["Q1", "Q2", "Q3", "Q4"];
}

export function buildRows(s: PLStatement, periods: Periods): StatementRow[] {
  const cells = (series: Series): number[] => (periods === "months" ? series : [1, 2, 3, 4].map((q) => quarter(series, q)));
  const row = (key: string, label: string, series: Series, kind: StatementRow["kind"] = "line", extra: Partial<StatementRow> = {}): StatementRow => ({
    key,
    label,
    cells: cells(series),
    total: sum(series),
    kind,
    ...extra,
  });

  const rows: StatementRow[] = [
    row("revenue", "Revenue", s.revenue, "subtotal"),
    row("cos", "Cost of sales", s.costOfSales, "line", { cost: true }),
    row("gross", "Gross profit", s.grossProfit, "subtotal"),
    ...s.operatingExpenseLines.map((l) => row(`opex-${l.subgroup_no}`, l.name, l.months, "line", { indent: true, cost: true })),
    row("opex", "Operating expenses", s.operatingExpenses, "subtotal", { cost: true }),
    row("operating", "Operating result", s.operatingResult, "subtotal"),
    row("other-income", "Other income & gains", s.otherIncome, "line"),
    ...(s.otherExpenseLines.length > 1
      ? s.otherExpenseLines.map((l) => row(`other-exp-${l.subgroup_no}`, l.name, l.months, "line", { indent: true, cost: true }))
      : []),
    row("other-expenses", "Other expenses & losses", s.otherExpenses, "line", { cost: true }),
    row("before-tax", "Income before tax", s.incomeBeforeTax, "subtotal"),
    row("tax", "Income tax", s.incomeTax, "line", { cost: true }),
    row("net", "Net income", s.netIncome, "total"),
  ];
  return rows;
}
