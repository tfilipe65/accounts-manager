// Financial metrics for the dashboard -- definitions, formulas and explanations in one place.
// Plain functions (no server actions) so the numbers can be unit-checked on their own.
//
// Where the figures cover only part of a year (the current year so far), anything that compares a
// whole year's activity with a balance is annualised, and days-based figures use the days elapsed,
// so a ratio at the end of March is comparable with one at the end of December.

export type MetricFormat = "ratio" | "percent" | "money" | "days";
export type MetricStatus = "good" | "watch" | "bad" | null;
export type MetricGroup = "Liquidity" | "Profitability" | "Efficiency" | "Leverage" | "Activity";

export type Metric = {
  key: string;
  group: MetricGroup;
  label: string;
  value: number | null; // null = cannot be worked out (nothing to divide by)
  format: MetricFormat;
  status: MetricStatus;
  formula: string;
  explanation: string;
  /** Shown when value is null. */
  unavailable: string;
};

export type MetricInputs = {
  daysElapsed: number; // days of the reporting year covered (365/366 for a finished year)
  daysInYear: number;
  paymentTermDays: number;
  // profit and loss, for the reporting year
  revenue: number;
  totalIncome: number; // revenue + other income
  costOfSales: number;
  grossProfit: number;
  operatingResult: number;
  netIncome: number;
  interestPaid: number;
  salesInvoicedInclVat: number;
  // balance sheet, at the end of the period
  currentAssets: number;
  currentLiabilities: number;
  inventory: number;
  receivables: number;
  nonCurrentAssets: number;
  totalAssets: number;
  liabilities: number; // all short-term liabilities
  longTermDebt: number; // interest-bearing borrowings
  equity: number;
};

const ratio = (num: number, den: number): number | null => (Math.abs(den) < 0.005 ? null : num / den);

export function computeMetrics(i: MetricInputs): Metric[] {
  const annual = i.daysElapsed > 0 ? i.daysInYear / i.daysElapsed : 1;
  const annualRevenue = i.revenue * annual;
  const annualCostOfSales = i.costOfSales * annual;
  const workingCapital = i.currentAssets - i.currentLiabilities;

  const m = (
    key: string,
    group: MetricGroup,
    label: string,
    value: number | null,
    format: MetricFormat,
    status: MetricStatus,
    formula: string,
    explanation: string,
    unavailable: string
  ): Metric => ({ key, group, label, value, format, status, formula, explanation, unavailable });

  const rate = (v: number | null, good: (v: number) => boolean, watch: (v: number) => boolean): MetricStatus =>
    v == null ? null : good(v) ? "good" : watch(v) ? "watch" : "bad";

  const currentRatio = ratio(i.currentAssets, i.currentLiabilities);
  const quickRatio = ratio(i.currentAssets - i.inventory, i.currentLiabilities);
  const grossMargin = ratio(i.grossProfit, i.revenue);
  const operatingMargin = ratio(i.operatingResult, i.revenue);
  const netMargin = ratio(i.netIncome, i.totalIncome);
  const fixedAssetTurnover = ratio(annualRevenue, i.nonCurrentAssets);
  const wcTurnover = workingCapital > 0 ? ratio(annualRevenue, workingCapital) : null;
  const assetTurnover = ratio(annualRevenue, i.totalAssets);
  const debtEquity = i.equity > 0 ? ratio(i.liabilities + i.longTermDebt, i.equity) : null;
  const gearing = i.equity + i.longTermDebt > 0 ? i.longTermDebt / (i.equity + i.longTermDebt) : null;
  const interestCover = i.interestPaid > 0.005 ? i.operatingResult / i.interestPaid : null;
  const dso = ratio(i.receivables, i.salesInvoicedInclVat) != null ? (i.receivables / i.salesInvoicedInclVat) * i.daysElapsed : null;
  const inventoryTurnover = i.inventory > 0.005 ? ratio(annualCostOfSales, i.inventory) : null;

  return [
    m("current-ratio", "Liquidity", "Current ratio", currentRatio, "ratio", rate(currentRatio, (v) => v >= 1.5, (v) => v >= 1),
      "Current assets ÷ current liabilities",
      "Can the business pay what it owes in the next twelve months from what it holds or will collect in that time? Above 1 means yes, with something to spare. Between 1.5 and 3 is comfortable for most businesses. Much higher can mean cash or stock is sitting idle.",
      "No current liabilities yet."),
    m("quick-ratio", "Liquidity", "Quick ratio", quickRatio, "ratio", rate(quickRatio, (v) => v >= 1, (v) => v >= 0.7),
      "(Current assets − stock) ÷ current liabilities",
      "A stricter version of the current ratio: it leaves out stock, because stock can take time to sell. It shows whether short-term debts could be met from cash and money owed by clients alone. Around 1 or more is the usual comfort level.",
      "No current liabilities yet."),
    m("working-capital", "Liquidity", "Working capital", workingCapital, "money", workingCapital >= 0 ? "good" : "bad",
      "Current assets − current liabilities",
      "The money available to run the business day to day after short-term debts are covered. Negative working capital means short-term debts exceed short-term assets and needs attention.",
      ""),
    m("gross-margin", "Profitability", "Gross margin", grossMargin, "percent", null,
      "(Revenue − cost of sales) ÷ revenue",
      "What is left of each euro of sales after the direct cost of delivering it, before overheads. A falling gross margin usually means prices have not kept up with costs.",
      "No revenue yet."),
    m("return-on-sales", "Profitability", "Return on sales", operatingMargin, "percent", operatingMargin == null ? null : operatingMargin >= 0 ? null : "bad",
      "Operating result ÷ revenue",
      "The operating margin: profit from running the business (after cost of sales and overheads, before other income, other expenses and tax) as a share of sales. It shows how efficiently the core activity turns sales into profit.",
      "No revenue yet."),
    m("net-margin", "Profitability", "Net margin", netMargin, "percent", netMargin == null ? null : netMargin >= 0 ? null : "bad",
      "Net income ÷ total income (revenue + other income)",
      "The share of everything the business earned that is left as profit after all costs and tax. Compared on total income so one-off other income cannot push it above 100%.",
      "No income yet."),
    m("fixed-asset-turnover", "Efficiency", "Fixed asset turnover", fixedAssetTurnover, "ratio", null,
      "Revenue (annualised) ÷ non-current assets",
      "How much revenue each euro tied up in long-term assets (equipment, vehicles, property) produces in a year. Higher means the assets are working harder. Compare with your own previous years, since it varies a lot by business.",
      "No long-term assets recorded."),
    m("working-capital-turnover", "Efficiency", "Working capital turnover", wcTurnover, "ratio", null,
      "Revenue (annualised) ÷ working capital",
      "How much revenue the business generates for each euro of working capital. A high figure means working capital is used efficiently. An extremely high figure can mean the business is running with too little cushion. Not meaningful when working capital is zero or negative.",
      "Needs positive working capital."),
    m("asset-turnover", "Efficiency", "Asset turnover", assetTurnover, "ratio", null,
      "Revenue (annualised) ÷ total assets",
      "How much revenue each euro of assets produces in a year. What counts as good depends on the kind of business: a trading business is often above 1, a business that holds a lot of property or equipment is usually well below 1. Track its direction rather than a fixed target.",
      "No assets recorded."),
    m("debt-equity", "Leverage", "Debt / equity", debtEquity, "ratio", rate(debtEquity, (v) => v <= 1, (v) => v <= 2),
      "(Liabilities + loans) ÷ equity",
      "How much the business owes compared with what the owners have put in and kept. Below 1 means owners fund more than creditors do. What is normal depends on the industry: asset-heavy businesses carry more debt than service businesses.",
      "Equity is zero or negative."),
    m("gearing", "Leverage", "Gearing", gearing, "percent", rate(gearing, (v) => v <= 0.5, (v) => v <= 0.7),
      "Loans ÷ (loans + equity)",
      "The share of the business's long-term funding that comes from borrowing rather than from owners. Up to about 50% is generally considered manageable; the higher it is, the more the business depends on lenders and interest payments.",
      "No funding recorded."),
    m("interest-cover", "Leverage", "Interest cover", interestCover, "ratio", rate(interestCover, (v) => v >= 3, (v) => v >= 1.5),
      "Operating result ÷ interest paid",
      "How many times the operating profit covers the interest due on loans. Below 1.5 is a warning sign; 3 or more is comfortable. Shown only once an interest expense account is chosen in Settings and has interest booked to it.",
      "No interest booked."),
    m("dso", "Activity", "Days sales outstanding", dso, "days", dso == null ? null : dso <= i.paymentTermDays + 10 ? "good" : dso <= i.paymentTermDays + 30 ? "watch" : "bad",
      "Receivables ÷ sales invoiced (incl. IVA) × days elapsed",
      "The average number of days clients take to pay. Compare it with your payment terms: well above them means clients are paying late and cash is being tied up.",
      "No sales invoiced yet."),
    m("inventory-turnover", "Activity", "Inventory turnover", inventoryTurnover, "ratio", null,
      "Cost of sales (annualised) ÷ stock",
      "How many times a year the stock is used up and replaced. Higher means stock moves quickly; a low figure means money is tied up in stock that sells slowly. Shown only for businesses that carry stock.",
      "No stock recorded."),
  ];
}

/** Days elapsed in a reporting year: the whole year for a past year, up to today for the current one. */
export function yearDays(year: number, today = new Date()): { daysElapsed: number; daysInYear: number } {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const daysInYear = Math.round((end - start) / 86400000);
  if (today.getFullYear() !== year) return { daysElapsed: daysInYear, daysInYear };
  const elapsed = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - start) / 86400000) + 1;
  return { daysElapsed: Math.max(1, Math.min(elapsed, daysInYear)), daysInYear };
}
