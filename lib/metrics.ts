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
  /** What to do about it; shown when the figure is amber or red. */
  advice: string[];
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
  purchasesInvoicedInclVat: number;
  /** Owed to suppliers at the end of the period (unpaid purchase invoices). */
  payables: number;
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

// What to do when a figure is amber or red. Shown on the dashboard under the explanation.
const ADVICE: Record<string, string[]> = {
  "current-ratio": [
    "Collect what clients owe you faster: send invoices the day work is done, chase anything past its due date, ask for stage payments or deposits.",
    "Ask suppliers for longer terms, or spread a large bill over instalments, so less falls due in the next twelve months.",
    "Turn a short-term loan or overdraft into a longer-term loan so less of it counts as due within the year.",
    "Pay in money the owners can leave in the business (capital, or a shareholder loan) rather than a loan that must be repaid soon.",
    "Cut or postpone spending that is not needed now, and keep owners' drawings in line with profit.",
  ],
  "quick-ratio": [
    "Collect client payments faster (see Days sales outstanding): receivables are the main thing that counts here.",
    "Run down slow-moving stock and avoid buying more than the next jobs need; stock does not count toward this ratio.",
    "Keep a cash buffer: move the IVA and tax money into its own account so it is not spent by mistake.",
    "Negotiate longer terms with suppliers, or pay the largest bills in instalments.",
  ],
  "working-capital": [
    "Bring in cash sooner: deposits before work starts, stage payments, and prompt invoicing and chasing.",
    "Delay what you can without penalty: agree longer supplier terms, and time large purchases to just after a payment arrives.",
    "Reduce stock you have paid for but not yet invoiced.",
    "Fund a lasting shortfall with long-term money (owner capital or a long-term loan) instead of short-term debt.",
  ],
  "gross-margin": [
    "Raise prices, or add a margin to materials you supply, on new quotes. Check old quotes against what the jobs really cost.",
    "Look at the cost of sales by supplier and by job: renegotiate the biggest, compare quotes, and buy in bulk where it is cheaper.",
    "Cut waste and rework on site or in the workshop; check that all materials are charged to a job and invoiced.",
    "Invoice everything you do (extras, variations, call-outs); unbilled work is cost with no sale.",
    "Stop or reprice the jobs and services that lose money, using the project report.",
  ],
  "return-on-sales": [
    "Check the operating expenses on the Profit and Loss page: look for costs that grew faster than sales, and cancel what you do not use.",
    "Raise gross margin first (see Gross margin): overheads are fixed, so every extra euro of margin goes straight to profit.",
    "Sell more through the same overheads: staff, premises and vehicles cost the same whether they are busy or not.",
    "Review vehicles, insurance, subscriptions, phones and software each year; get two quotes for the biggest.",
  ],
  "net-margin": [
    "Improve the operating result first: gross margin and overheads (see the two figures above).",
    "Look at interest and bank charges: repay or renegotiate expensive borrowing, and move to an account with lower fees.",
    "Check for one-off losses, bad debts and corrections that depressed the year.",
    "Ask your accountant whether the tax charge is right and whether allowable costs are missing.",
  ],
  "debt-equity": [
    "Pay down loans, starting with the most expensive, and avoid taking new borrowing for things the business can fund from profit.",
    "Build up equity: keep profit in the business and limit owners' drawings and dividends until the ratio improves.",
    "Owners can add capital (or turn a loan from them into capital) to strengthen the balance sheet.",
    "Pay suppliers and tax on time: overdue bills count as debt too.",
  ],
  gearing: [
    "Repay loans early where the loan allows it, using cash that is surplus after the IVA and tax reserve.",
    "Refinance an expensive loan at a lower rate or a longer term to ease the pressure on cash.",
    "Keep profit in the business to grow equity, and avoid financing day-to-day costs with loans.",
    "Pay for new equipment from cash or a smaller loan, with a larger deposit.",
  ],
  "interest-cover": [
    "Raise the operating result: higher gross margin and lower overheads give more profit to pay interest from.",
    "Cut the interest bill: repay the most expensive loan first, or refinance at a lower rate.",
    "Switch overdraft borrowing to a cheaper term loan, and avoid card and supplier-credit interest.",
    "Hold off on new borrowing until cover is back above 3.",
  ],
  dso: [
    "Invoice the day the work is done, with a clear due date and bank details, and put your payment terms on every quote.",
    "Ask for a deposit or stage payments before starting, and do not start the next stage while the last one is unpaid.",
    "Remind clients a few days before the due date, then chase the day after, by phone as well as email. The Ageing page lists who to call first.",
    "Offer a small early-payment discount, or charge late-payment interest as the law allows, and tell clients that you will.",
    "Stop work for clients who are far overdue and review whether to keep supplying them.",
  ],
  dpo: [
    "If this is lower than your days sales outstanding, you are paying suppliers before clients pay you: ask for longer supplier terms (45 or 60 days) on your biggest suppliers.",
    "Pay on the due date, not the day the invoice arrives; pay in one weekly run so you are not tied to every invoice.",
    "Combine this with faster collection (see Days sales outstanding): the gap between the two figures is the cash you are lending to your clients.",
    "If the figure is far beyond your suppliers' terms, catch up on the oldest bills now and agree a plan: late fees, lost discounts and refused credit cost more than the cash is worth.",
  ],
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
  ): Metric => ({ key, group, label, value, format, status, formula, explanation, unavailable, advice: ADVICE[key] ?? [] });

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
  const dpo = ratio(i.payables, i.purchasesInvoicedInclVat) != null ? (i.payables / i.purchasesInvoicedInclVat) * i.daysElapsed : null;
  // Favourable when suppliers are paid later than clients pay us (we are not financing our clients). Paying far beyond
  // the terms suppliers gave is flagged as a watch point, not a good result.
  const benchmark = dso ?? i.paymentTermDays;
  const dpoStatus: MetricStatus =
    dpo == null ? null : dpo > i.paymentTermDays + 45 ? "watch" : dpo >= benchmark ? "good" : dpo >= benchmark - 10 ? "watch" : "bad";
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
    m("gross-margin", "Profitability", "Gross margin", grossMargin, "percent", grossMargin == null ? null : grossMargin > 0 ? "good" : "bad",
      "(Revenue − cost of sales) ÷ revenue",
      "What is left of each euro of sales after the direct cost of delivering it, before overheads. A falling gross margin usually means prices have not kept up with costs.",
      "No revenue yet."),
    m("return-on-sales", "Profitability", "Return on sales", operatingMargin, "percent", operatingMargin == null ? null : operatingMargin >= 0 ? "good" : "bad",
      "Operating result ÷ revenue",
      "The operating margin: profit from running the business (after cost of sales and overheads, before other income, other expenses and tax) as a share of sales. It shows how efficiently the core activity turns sales into profit.",
      "No revenue yet."),
    m("net-margin", "Profitability", "Net margin", netMargin, "percent", netMargin == null ? null : netMargin >= 0 ? "good" : "bad",
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
    m("dpo", "Activity", "Days expenses outstanding", dpo, "days", dpoStatus,
      "Unpaid supplier invoices ÷ purchases invoiced (incl. IVA) × days elapsed",
      "The average number of days it takes you to pay suppliers. Compare it with days sales outstanding: when this figure is higher, clients pay you before you have to pay suppliers, so supplier credit funds the gap and cash stays in the bank (favourable). When it is lower, you pay out before you collect and are financing your clients from your own cash. It is flagged as a watch point if it runs far beyond your payment terms, because that risks late fees, lost discounts and strained supplier relationships.",
      "No purchases invoiced yet."),
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
