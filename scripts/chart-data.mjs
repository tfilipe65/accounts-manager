// The new chart of accounts, as data. One source for: the review document (chart-draft.mjs), the
// database seed (build-chart.mjs) and, through the seed, the app. Edit the chart here, then run
//   node scripts/build-chart.mjs && node scripts/chart-draft.mjs

// Business templates: C Construction (Teia Firme), W Carpentry (Woodgrain), I Decorations (Algarve Interior),
// P Property management (Casas Algarve), K Client money account.
export const TEMPLATES = { C: "Construction", W: "Carpentry", I: "Decorations", P: "Property mgmt", K: "Client account" };

// Sections (statement lines) and their subgroups. `role` is what the app will use instead of hard-coded numbers.
// normal: the usual balance of the subgroup. Contra accounts (discounts, depreciation) are flagged on the account.
export const SECTIONS = [
  { key: "CA", name: "Current assets", statement: "Balance sheet" },
  { key: "NCA", name: "Non-current assets", statement: "Balance sheet" },
  { key: "CL", name: "Liabilities", statement: "Balance sheet" },
  { key: "LTD", name: "Long-term debt", statement: "Balance sheet" },
  { key: "EQ", name: "Equity", statement: "Balance sheet" },
  { key: "INC", name: "Income", statement: "Profit & loss" },
  { key: "COS", name: "Cost of sales (direct costs)", statement: "Profit & loss" },
  { key: "OPEX", name: "Operating expenses", statement: "Profit & loss" },
  { key: "FIN", name: "Financing and tax", statement: "Profit & loss" },
];

export const SUBGROUPS = [
  { key: "cash", section: "CA", name: "Cash and bank", normal: "debit", role: "cash" },
  { key: "recv", section: "CA", name: "Clients", normal: "debit", role: "receivables" },
  { key: "oca", section: "CA", name: "Other current assets and VAT recoverable", normal: "debit", role: "other_current_assets" },
  { key: "stock", section: "CA", name: "Stock", normal: "debit", role: "inventory" },
  { key: "fa", section: "NCA", name: "Fixed assets (cost)", normal: "debit", role: "fixed_assets" },
  { key: "accdep", section: "NCA", name: "Accumulated depreciation", normal: "credit", role: "accumulated_depreciation" },
  { key: "pay", section: "CL", name: "Suppliers", normal: "credit", role: "payables" },
  { key: "state", section: "CL", name: "VAT and State", normal: "credit", role: "state_liabilities" },
  { key: "staff", section: "CL", name: "Staff and accruals", normal: "credit", role: "staff_liabilities" },
  { key: "cfunds", section: "CL", name: "Customer money and deposits", normal: "credit", role: "customer_funds" },
  { key: "std", section: "CL", name: "Borrowings due within a year", normal: "credit", role: "short_term_debt" },
  { key: "ltd", section: "LTD", name: "Borrowings due after a year", normal: "credit", role: "long_term_debt" },
  { key: "cap", section: "EQ", name: "Capital", normal: "credit", role: "equity_capital" },
  { key: "ret", section: "EQ", name: "Reserves and retained earnings", normal: "credit", role: "retained_earnings" },
  { key: "rev", section: "INC", name: "Revenue", normal: "credit", role: "revenue" },
  { key: "oinc", section: "INC", name: "Other income and gains", normal: "credit", role: "other_income" },
  { key: "iinc", section: "INC", name: "Interest earned", normal: "credit", role: "interest_income" },
  { key: "mat", section: "COS", name: "Materials and goods", normal: "debit", role: "cost_materials" },
  { key: "dsvc", section: "COS", name: "Subcontractors and direct services", normal: "debit", role: "cost_direct_services" },
  { key: "dlab", section: "COS", name: "Direct labour", normal: "debit", role: "cost_direct_labour" },
  { key: "ostaff", section: "OPEX", name: "Staff costs: office and management", normal: "debit", role: "opex_staff" },
  { key: "prem", section: "OPEX", name: "Premises and utilities", normal: "debit", role: "opex_premises" },
  { key: "veh", section: "OPEX", name: "Vehicles and travel", normal: "debit", role: "opex_vehicles" },
  { key: "adm", section: "OPEX", name: "Professional and administrative", normal: "debit", role: "opex_admin" },
  { key: "tax", section: "OPEX", name: "Taxes and licences", normal: "debit", role: "opex_taxes" },
  { key: "dep", section: "OPEX", name: "Depreciation", normal: "debit", role: "depreciation" },
  { key: "oexp", section: "OPEX", name: "Other expenses and losses", normal: "debit", role: "other_expense" },
  { key: "fin", section: "FIN", name: "Financing costs", normal: "debit", role: "interest_expense" },
  { key: "itax", section: "FIN", name: "Income tax", normal: "debit", role: "income_tax" },
];

// Rows are written with the numbers of the first draft (a reference only: they are renumbered at the bottom of this file).
// [draft number, name, Portuguese name, subgroup, reference code, match, templates, app role (single-use), note, contra?]
const ALL = "CWIPK";
const A_SRC = [
  // ---- cash and bank ----
  [1110, "Petty cash", "Caixa", "cash", "11", "exact", "CWIP", "petty_cash"],
  [1210, "Bank account 1: current account", "Depósitos à ordem: conta corrente", "cash", "12", "exact", ALL, "", "Further bank accounts added in the app take the next free number in this subgroup."],
  [1220, "Bank account 2: IVA and tax reserve", "Depósitos à ordem: conta IVA/impostos", "cash", "12", "exact", "CWIP"],
  [1230, "Bank account 3", "Depósitos à ordem: conta 3", "cash", "12", "exact", "CWIP"],
  [1240, "Payment platforms to collect (card terminals, booking payouts)", "Valores a receber de plataformas de pagamento", "cash", "12", "confirm", "P"],
  [1290, "Transfers between own accounts (clearing)", "Transferências internas", "cash", "12", "sub", ALL, "transfers_clearing", "Always nets to zero; shown so a missing side of a transfer is visible."],
  // ---- clients ----
  [2110, "Clients (accounts receivable)", "Clientes c/c", "recv", "211", "exact", ALL, "accounts_receivable"],
  [2119, "Clients: guarantee retentions held back", "Clientes: retenções de garantia", "recv", "211", "sub", "C", "", "Builders: part of each stage payment held until the guarantee period ends."],
  // ---- other current assets ----
  [2250, "Advances, deposits and other debtors", "Adiantamentos, cauções e outros devedores", "oca", "225/232/278", "exact", "CWIP", "", "Advances to suppliers or staff, deposits paid, tax paid on account, anything owed to us that is not a client."],
  [2432, "VAT recoverable (input VAT)", "IVA dedutível", "oca", "2432", "exact", ALL, "vat_input"],
  [2437, "VAT to be refunded", "IVA a recuperar", "oca", "2437", "exact", "CWIP"],
  [2811, "Prepaid expenses", "Gastos a reconhecer", "oca", "281", "exact", "CWIP", "", "For example insurance paid for the whole year."],
  // ---- stock ----
  [3210, "Goods and materials in stock", "Mercadorias e matérias-primas", "stock", "32/33", "exact", "CW"],
  // ---- fixed assets ----
  [4320, "Buildings and improvements", "Edifícios e outras construções", "fa", "432", "exact", "CWI"],
  [4330, "Plant, machinery and tools", "Equipamento básico", "fa", "433", "exact", "CW"],
  [4340, "Motor vehicles", "Equipamento de transporte", "fa", "434", "exact", "CWIP"],
  [4350, "Office, IT and other equipment (including software)", "Equipamento administrativo e outros", "fa", "435/437/44", "exact", "CWIP"],
  [4822, "Accumulated depreciation (all fixed assets)", "Depreciações acumuladas", "accdep", "482/484", "exact", "CWIP", "", "One account for the total written off so far. The fixed assets above stay at cost.", true],
  // ---- suppliers ----
  [2210, "Suppliers (accounts payable)", "Fornecedores c/c", "pay", "221", "exact", ALL, "accounts_payable"],
  [2212, "Suppliers: guarantee retentions withheld", "Fornecedores: retenções de garantia", "pay", "221", "sub", "C", "", "Builders: retained from subcontractors until their guarantee ends."],
  // ---- VAT and State ----
  [2433, "VAT charged (output VAT)", "IVA liquidado", "state", "2433", "exact", ALL, "vat_output"],
  [2436, "VAT payable: settlement account", "IVA a pagar", "state", "2436", "exact", ALL, "vat_settlement", "Payments to the State clear it."],
  [2414, "Corporate income tax payable (IRC)", "IRC: imposto a pagar", "state", "2414", "confirm", "CWIP"],
  [2421, "Withheld income tax payable (IRS and IRC withholding)", "Retenção de impostos sobre rendimentos", "state", "2421/2422", "confirm", "CWIP", "withholding_payable", "Tax withheld from salaries and from independent professionals. Owed to the State, never a cost."],
  [2451, "Social security payable", "Contribuições para a Segurança Social", "state", "245", "exact", "CWIP", "social_security_payable", "Employee 11% and employer share, owed to the State."],
  [2441, "Other taxes payable (IMI, stamp duty, municipal)", "Outros impostos", "state", "244", "exact", "CWIP"],
  // ---- staff and accruals ----
  [2311, "Salaries payable", "Remunerações a pagar", "staff", "231", "exact", "CWIP", "net_pay_payable"],
  [2722, "Accrued holiday and Christmas pay", "Credores por acréscimos de gastos: férias e subsídios", "staff", "2722", "exact", "CWIP", "holiday_accrual", "The two extra months of pay built up through the year (duodécimos)."],
  [2723, "Other accruals and income received in advance", "Acréscimos de gastos e rendimentos a reconhecer", "staff", "2722/282", "sub", "CWIP", "", "Costs incurred but not yet invoiced (for example interest), and income received before it is earned."],
  // ---- customer money ----
  [2761, "Customer advances and deposits", "Adiantamentos de clientes", "cfunds", "276", "exact", "CWI"],
  [2788, "Client money held for owners", "Outros credores: dinheiro de clientes", "cfunds", "278", "sub", "PK", "client_money", "Property management: rent collected and held for owners."],
  [2789, "Guest and tenant deposits held", "Cauções recebidas", "cfunds", "278", "sub", "PK"],
  // ---- borrowings ----
  [2511, "Bank loans: due within a year", "Empréstimos bancários", "std", "2511", "exact", "CWIP", "loan_principal"],
  [2512, "Overdraft, credit cards and other finance", "Descobertos, cartões e outros financiamentos", "std", "2512/2519", "exact", "CWIP"],
  [2513, "Leasing", "Locações financeiras", "std", "2513", "exact", "CWIP"],
  [2681, "Shareholder loans (suprimentos)", "Sócios: suprimentos", "std", "268", "sub", "CWIP"],
  [2514, "Bank loans: due after a year", "Empréstimos bancários: não corrente", "ltd", "2511", "sub", "CWIP", "", "Own split of the loan so the balance sheet can show current and non-current."],
  // ---- equity ----
  [5110, "Share capital and owners' contributions", "Capital social e prestações suplementares", "cap", "51/53", "exact", "CWIPK", "share_capital"],
  [2631, "Partner drawings (advances on profits)", "Adiantamentos por conta de lucros", "cap", "263", "exact", "CWIP", "", "Money taken out by the owners; reduces equity.", true],
  [5590, "Reserves", "Reservas", "ret", "551/559", "exact", "CWIP"],
  [5610, "Retained earnings", "Resultados transitados", "ret", "56", "exact", "CWIPK", "retained_earnings", "The current year's result is calculated by the app and is not an account here."],
  // ---- revenue ----
  [7110, "Sales of goods and materials", "Vendas de mercadorias", "rev", "711", "exact", "CWI"],
  [7120, "Sales of made-to-order joinery (kitchens, wardrobes, doors)", "Vendas de produtos acabados", "rev", "712", "exact", "W", "default_sales"],
  [7211, "Construction works (including labour and site supervision)", "Prestações de serviços: obras", "rev", "721", "sub", "C", "default_sales"],
  [7213, "Design and project management", "Prestações de serviços: projecto e gestão", "rev", "721", "sub", "C"],
  [7214, "Installation and fitting", "Prestações de serviços: montagem", "rev", "721", "sub", "WI"],
  [7215, "Repairs and restoration", "Prestações de serviços: reparações", "rev", "721", "sub", "W"],
  [7221, "Design and consultancy fees", "Prestações de serviços: design e consultoria", "rev", "722", "sub", "I", "default_sales"],
  [7222, "Styling and staging", "Prestações de serviços: decoração e staging", "rev", "722", "sub", "I"],
  [7231, "Management commissions", "Prestações de serviços: comissões de gestão", "rev", "723", "sub", "P", "default_sales"],
  [7232, "Guest services, maintenance coordination and inspections", "Prestações de serviços: hóspedes, manutenção e inspecções", "rev", "723", "sub", "P"],
  [7234, "Rental income from own properties", "Prestações de serviços: rendas", "rev", "723", "sub", "P"],
  [7241, "Account administration fees", "Prestações de serviços: administração de conta", "rev", "724", "sub", "K", "default_sales"],
  [7190, "Discounts and returns allowed", "Descontos e abatimentos concedidos", "rev", "71", "confirm", ALL, "", "Credit notes can post here.", true],
  // ---- other income ----
  [7810, "Recharged costs to clients", "Rendimentos suplementares", "oinc", "781", "exact", "CWIP"],
  [7889, "Other income and gains (grants, insurance claims, asset sales, bad debts recovered)", "Outros rendimentos e ganhos", "oinc", "75/782/783/788", "exact", ALL],
  [7910, "Interest earned", "Juros obtidos", "iinc", "791", "exact", "CWIPK", "interest_income"],
  // ---- cost of sales: materials ----
  [6110, "Materials and goods used", "Matérias e mercadorias consumidas", "mat", "61", "exact", "CWI", "default_materials"],
  [6111, "Timber and boards", "Madeiras e derivados", "mat", "61", "sub", "W"],
  [6112, "Hardware and fittings", "Ferragens e acessórios", "mat", "61", "sub", "W"],
  [6113, "Finishes (varnish, paint, glue)", "Acabamentos", "mat", "61", "sub", "W"],
  [6121, "Furnishings and soft goods for resale", "Mobiliário e têxteis para venda", "mat", "61", "sub", "I"],
  [6150, "Change in stock (year-end count)", "Variação nos inventários", "mat", "61", "exact", "CW", "stock_change", "Posted by Year-End Stock: the closing count on 31 Dec, reversed on 1 Jan."],
  [6190, "Purchase returns and discounts", "Devoluções e descontos obtidos", "mat", "61", "sub", "CWI", "", "Goods sent back to a supplier, or a discount the supplier gives after the invoice. Reduces the cost of materials.", true],
  // ---- cost of sales: services ----
  [6211, "Subcontractors (trades)", "Subcontratos", "dsvc", "621", "exact", "CWI"],
  [6212, "Specialist and design services", "Trabalhos especializados", "dsvc", "6221", "exact", "CWI"],
  [6213, "Equipment and plant hire for jobs", "Rendas e alugueres de equipamento", "dsvc", "6261", "exact", "CW"],
  [6215, "Small tools and consumables", "Ferramentas e utensílios de desgaste rápido", "dsvc", "6231", "exact", "CWIP"],
  [6216, "Other direct job costs (skips, waste, deliveries)", "Outros gastos directos", "dsvc", "6268", "exact", "CWI"],
  [6217, "Cleaning and laundry for managed properties", "Limpeza e lavandaria", "dsvc", "6267", "exact", "P"],
  [6218, "Pool and garden maintenance", "Conservação: piscina e jardim", "dsvc", "6226", "exact", "P"],
  [6219, "Repairs and maintenance of managed properties", "Conservação e reparação", "dsvc", "6226", "exact", "P"],
  [6220, "Booking-platform commissions", "Comissões de plataformas de reserva", "dsvc", "6225", "exact", "P"],
  // ---- direct labour ----
  [6321, "Wages: site and workshop staff", "Remunerações do pessoal: produção", "dlab", "632", "sub", "CW", "wages_direct"],
  [6351, "Employer social security: direct staff", "Encargos sobre remunerações: produção", "dlab", "635", "sub", "CW", "employer_social_security_direct"],
  [6361, "Insurance and training: direct staff", "Seguros, segurança e formação: produção", "dlab", "636/638", "sub", "CW"],
  // ---- office staff ----
  [6311, "Management remuneration", "Remunerações dos órgãos sociais", "ostaff", "631", "exact", "CWIP"],
  [6322, "Wages: office staff", "Remunerações do pessoal: administrativo", "ostaff", "632", "sub", "CWIP", "wages_office"],
  [6352, "Employer social security: office staff and management", "Encargos sobre remunerações: administrativo e gerência", "ostaff", "635", "sub", "CWIP", "employer_social_security_office"],
  [6371, "Other staff costs (insurance, welfare, training)", "Outros gastos com o pessoal", "ostaff", "636/637/638", "exact", "CWIP"],
  // ---- premises ----
  [6261, "Rent of premises", "Rendas e alugueres", "prem", "6261", "exact", "CWIP"],
  [6241, "Electricity and water", "Electricidade e água", "prem", "6241/6243", "exact", "CWIP"],
  [6262, "Telephone and internet", "Comunicação", "prem", "6262", "exact", "CWIP"],
  [6226, "Repairs and maintenance of premises", "Conservação e reparação", "prem", "6226", "exact", "CWIP"],
  [6267, "Cleaning and hygiene of premises", "Limpeza, higiene e conforto", "prem", "6267", "exact", "CWIP"],
  // ---- vehicles and travel ----
  [6242, "Fuel", "Combustíveis", "veh", "6242", "exact", "CWIP"],
  [6227, "Vehicle repairs, servicing and inspections", "Conservação e reparação: viaturas", "veh", "6226", "sub", "CWIP"],
  [6252, "Tolls, parking and travel", "Portagens, estacionamento e deslocações", "veh", "6252/6251", "confirm", "CWIP"],
  [62631, "Insurance: vehicles", "Seguros: viaturas", "veh", "6263", "sub", "CWIP"],
  // ---- professional and administrative ----
  [6224, "Accounting, legal and professional fees", "Honorários, contencioso e notariado", "adm", "6224/6265", "exact", ALL],
  [6233, "Office supplies and printing", "Material de escritório", "adm", "6233", "exact", "CWIP"],
  [62682, "Software, subscriptions and web services", "Serviços: software e subscrições", "adm", "6268", "sub", "CWIP"],
  [62632, "Insurance: business, liability and contract works", "Seguros: responsabilidade civil e obras", "adm", "6263", "sub", "CWIP"],
  [6222, "Advertising and marketing", "Publicidade e propaganda", "adm", "6222", "exact", "CWIP"],
  [6225, "Commissions paid to agents", "Comissões", "adm", "6225", "exact", "CWIP"],
  [6266, "Meals, entertainment and gifts", "Despesas de representação e ofertas", "adm", "6266/6234", "exact", "CWIP"],
  [62681, "Bank charges and commissions", "Serviços bancários", "adm", "6268", "confirm", "CWIPK", "bank_charges"],
  [6268, "Other external services", "Outros serviços", "adm", "6268", "exact", "CWIPK"],
  // ---- taxes and licences ----
  [6811, "Vehicle and property taxes (IUC, IMI)", "Impostos directos", "tax", "6811", "exact", "CWIP"],
  [6812, "Stamp duty, fees, licences and permits", "Impostos indirectos, taxas e licenças", "tax", "6812/6813", "exact", "CWIP"],
  // ---- depreciation ----
  [6422, "Depreciation (all fixed assets)", "Depreciações e amortizações", "dep", "642/644", "exact", "CWIP", "", "One account for the year's depreciation of every fixed asset."],
  // ---- other expenses ----
  [6830, "Bad debts written off", "Dívidas incobráveis", "oexp", "683", "exact", "CWIP"],
  [6840, "Stock losses", "Perdas em inventários", "oexp", "684", "exact", "CWI"],
  [6882, "Donations and memberships", "Donativos e quotizações", "oexp", "6882/6883", "exact", "CWIP"],
  [6888, "Other expenses and losses (including losses on asset sales)", "Outros gastos e perdas", "oexp", "6881/6887/6888", "exact", "CWIPK"],
  // ---- financing and tax ----
  [6911, "Interest on bank loans", "Juros suportados: empréstimos", "fin", "691", "exact", "CWIP", "interest_expense"],
  [6912, "Other interest and finance costs (overdraft, leasing, cards, loan fees)", "Juros suportados e outros gastos de financiamento", "fin", "691/698", "exact", "CWIP"],
  [8121, "Corporate income tax (IRC) for the year", "Imposto estimado para o período", "itax", "8121", "exact", "CWIP", "income_tax"],
];

// Accounts of the first draft that were folded into another one when the chart was simplified.
// removed draft number -> the draft number that now carries it. NEW_NO below answers for both, so old references
// (the workbook port, the old-to-new table) still land on a real account.
const MERGED = {
  2118: 2110, 2321: 2250, 2411: 2250, 2721: 2250, 2781: 2250, 2784: 2250,
  4370: 4350, 4410: 4350, 4110: 4350,
  4823: 4822, 4824: 4822, 4825: 4822, 4827: 4822, 4841: 4822,
  2710: 2210, 2821: 2723, 2519: 2512, 5310: 5110, 5510: 5590,
  7212: 7211, 7233: 7232, 7235: 7232,
  7510: 7889, 7820: 7889, 7830: 7889, 7881: 7889, 7885: 7889,
  6214: 6216, 6231: 6215, 6381: 6361, 6353: 6352, 6362: 6371, 6382: 6371,
  6243: 6241, 6251: 6252, 6265: 6224, 6234: 6266, 6813: 6812,
  6423: 6422, 6424: 6422, 6425: 6422, 6427: 6422, 6441: 6422,
  6881: 6888, 6887: 6888, 6883: 6882, 6981: 6912,
};

// Where every account of the CURRENT chart goes. [old no, old name, new number(s), why]
const OLD_SRC = [
  [100, "Business Check Acct.", "1210", "Bank account 1"],
  [110, "Business IVA Acct.", "1220", "Bank account 2"],
  [122, "Cash Account", "1230", "It is a bank account, not cash"],
  [130, "Petty Cash Acct.", "1110", ""],
  [300, "Accounts Receivable", "2110", ""],
  [301, "Other Current Assets", "2781", ""],
  [720, "Plant & Machinery", "4330", ""],
  [740, "Equipment", "4350", ""],
  [760, "Motor Vehicles", "4340", ""],
  [780, "Other Non-Currents Assets", "4110", ""],
  [790, "Inventory", "3210", "Stock is a current asset"],
  [1000, "Accounts Payable", "2210", ""],
  [1110, "Interest Payable", "2723", "Accrued cost"],
  [1120, "Sales Tax Payable", "2433", "VAT charged"],
  [1130, "Purchases Tax Payable", "2432", "VAT recoverable"],
  [1150, "Payroll Tax - IRS", "2421", ""],
  [1160, "Income Tax - IRC", "2414", ""],
  [1170, "Transfers Between A/C's", "1290", "Moves to cash and bank: it is a clearing account, not a liability"],
  [1180, "Credits & Loans", "2511 / 2514", "Split into due within and after a year"],
  [1200, "Capital", "5110", ""],
  [1210, "Owners Contributions", "5310", ""],
  [1230, "Owners Draw", "2631", ""],
  [1400, "Retained Earnings", "5610", ""],
  [1410, "Other Reserves", "5590", ""],
  [1420, "Current Year P/L", "(dropped)", "The app works out the year's result itself; a manual account invited double counting"],
  [2000, "General Sales", "7211 / 7120 / 7221 / 7231", "By business: construction / carpentry / decorations / property management"],
  [2010, "Credits/Discounts Allowed", "7190", ""],
  [2020, "Investment Income", "7910", "Was under revenue; it is financial income"],
  [2030, "Gains from sale of Assets", "7885", ""],
  [2040, "Other Income", "7889", ""],
  [2050, "Tax Refunds", "(dropped)", "A refund reduces the tax account it came from; booking it as income overstates profit. Use 2437."],
  [2060, "Insurance Claims", "7881", ""],
  [2070, "Interest Earned", "7910", ""],
  [2100, "Material Purchases", "6110", "Carpentry: 6111 to 6113"],
  [2110, "Field Staff - Wages", "6321", "Direct labour"],
  [2120, "Subcontractors", "6211", ""],
  [2130, "Professional Services", "6212", ""],
  [2140, "Equipment & Consumables", "6213 / 6215", "Hire versus consumables"],
  [2150, "Credits Received", "6190", "Contra account"],
  [2160, "Waste Disposal", "6214", ""],
  [2170, "Other Job Costs", "6216", ""],
  [2200, "Advertising", "6222", ""],
  [2210, "Marketing & Promotions", "6222", "Merged"],
  [2220, "Gifs and Samples", "6234", ""],
  [2230, "Bad Debts", "6830", ""],
  [2240, "Education & Training", "6382", ""],
  [2250, "Commissions Paid", "6225", ""],
  [2270, "Licenses & Permits", "6813", ""],
  [2280, "Office Supplies", "6233", ""],
  [2290, "External Services", "6268", ""],
  [2300, "Postage & Deliveries", "6268", "Merged"],
  [2310, "Printing & Reproduction", "6233", "Merged"],
  [2320, "Salaries (Admin)", "6322", ""],
  [2330, "Subscriptions", "62682", ""],
  [2340, "Other Admin Expenses", "6268", "Merged"],
  [2350, "Food & Beverages (Office)", "6266", ""],
  [2360, "Payroll Expenses/Benefits", "6371 / 6382", ""],
  [2370, "Loan Repayments", "2511", "Repaying principal reduces the loan; only the interest (6911) is a cost"],
  [2500, "Fuel and Petrol", "6242", ""],
  [2510, "Auto Inspections - MOT", "6227", "Merged"],
  [2520, "Auto Maintenance & Repairs", "6227", ""],
  [2530, "Tolls & Parking", "6252", ""],
  [2540, "IUC - Imp. Unico Circulação", "6811", ""],
  [2600, "Automotive Insurance", "62631", ""],
  [2610, "Builders Insurance", "62632", "Merged with liability and business insurance"],
  [2620, "Health Insurance", "6371", ""],
  [2630, "Public Liability", "62632", "Merged"],
  [2640, "Business Insurance", "62632", "Merged"],
  [2650, "Workers Comp. Insurance", "6361 / 6362", "By direct or office staff"],
  [2700, "Accounting Fees", "6224", ""],
  [2710, "Legal Fees", "6265", ""],
  [2720, "Other Professionals", "6224", "Merged"],
  [2810, "Meals & Restaurants", "6266", "Merged"],
  [2820, "Travel Expenses", "6251", ""],
  [2830, "Health & Safety", "6381 / 6382", ""],
  [2900, "Electricity", "6241", ""],
  [2910, "Telephone & Internet", "6262", ""],
  [2930, "Water", "6243", ""],
  [2940, "Hardware", "6231", "Small items expensed; larger purchases are fixed assets (4350)"],
  [2950, "Software", "62682", "Merged"],
  [2960, "Webservices", "62682", "Merged"],
  [2970, "Fundo de Compensação", "6351 / 6352", "Employer charge"],
  [2990, "IGFSS - Seg. Social", "2451 (+ 6351 / 6352)", "Owed to the State; only the employer share is a cost"],
  [3000, "IVA - Paid / Received", "2436", ""],
  [3010, "Retenção na Fonte", "2421", "Withheld from pay, owed to the State: a liability, not a cost"],
  [3020, "Income Tax Expense", "8121", ""],
  [3030, "Interest Expense", "6911", ""],
  [3040, "Bank Fees", "62681", ""],
  [3050, "Finance Charges", "6981", ""],
  [3060, "Assets Depreciation", "6422 to 6441", "By class of asset"],
];


// ---- numbering used in the database -------------------------------------------------------------
// Groups keep the numbers the app has always used (1 Income, 2 Cost of sales, 3 Operating expenses, 4 Current
// assets, 5 Non-current assets, 6 Liabilities, 7 Long-term debt, 8 Equity) plus 9 Financing and tax.
export const GROUP_NO = { INC: 1, COS: 2, OPEX: 3, CA: 4, NCA: 5, CL: 6, LTD: 7, EQ: 8, FIN: 9 };
export const GROUP_NAME = {
  INC: "Income", COS: "Cost of Sales", OPEX: "Operating Expenses", CA: "Current Assets", NCA: "Non-Current Assets",
  CL: "Liabilities", LTD: "Long Term Debt", EQ: "Equity", FIN: "Financing and Tax",
};
/** subgroup_no: group number x 100, then steps of 10 in the order listed above. */
const SUBGROUP_NO_OLD = (() => {
  const next = {};
  const out = {};
  for (const sg of SUBGROUPS) {
    next[sg.section] = (next[sg.section] ?? 0) + 10;
    out[sg.key] = GROUP_NO[sg.section] * 100 + next[sg.section];
  }
  return out;
})();

/** Which template each company slug starts from (new companies pick one when they are added). */
export const TEMPLATE_BY_SLUG = {
  "teia-firme": "C",
  woodgrain: "W",
  "algarve-interior": "I",
  "casas-algarve": "P",
  "casas-algarve-clients": "K",
  test: "C",
};


// ---- OUR OWN NUMBERING ------------------------------------------------------------------------------
// Account number = 4 digits: group, subgroup, account.
//   first digit   the group      (1 Income, 2 Cost of sales, 3 Operating expenses, 4 Current assets, 5 Non-current assets,
//                                 6 Liabilities, 7 Long-term debt, 8 Equity, 9 Financing and tax)
//   second digit  the subgroup within its group (Revenue 11, Other income 12, ...)
//   last two      the account within its subgroup, 01, 02, ... in the order listed above
// The app never depends on a number (it finds accounts by role), so this can be changed here at any time.
export const SUBGROUP_NO_NEW = (() => {
  const next = {};
  const out = {};
  for (const sg of SUBGROUPS) {
    next[sg.section] = (next[sg.section] ?? 0) + 1;
    if (next[sg.section] > 9) throw new Error(`group ${sg.section} has more than 9 subgroups`);
    out[sg.key] = GROUP_NO[sg.section] * 10 + next[sg.section];
  }
  return out;
})();

/** draft number -> new number, for every account in the chart. */
export const NEW_NO = (() => {
  const map = {};
  for (const sg of SUBGROUPS) {
    const rows = A_SRC.filter((a) => a[3] === sg.key); // numbered in the order written above
    if (rows.length > 99) throw new Error(`subgroup ${sg.key} has more than 99 accounts`);
    rows.forEach((a, i) => (map[a[0]] = SUBGROUP_NO_NEW[sg.key] * 100 + i + 1));
  }
  // A folded-in account answers with the number of the account that now carries it, provided that account is in every
  // template the old one was in.
  for (const [from, to] of Object.entries(MERGED)) {
    if (map[to] === undefined) throw new Error(`merged account ${from} points at ${to}, which is not in the chart`);
    map[from] = map[to];
  }
  return map;
})();

/** Replace draft account numbers inside a piece of text with the new ones. */
export const renum = (text) => (text == null ? text : String(text).replace(/\b\d{4,5}\b/g, (n) => (NEW_NO[n] !== undefined ? String(NEW_NO[n]) : n)));

export const A = A_SRC.map((a) => [NEW_NO[a[0]], a[1], a[2], a[3], a[4], a[5], a[6], a[7], renum(a[8]), a[9]]);
// [old number, old name, new number(s) as text, why]
export const OLD = OLD_SRC.map((o) => [o[0], o[1], renum(o[2]), renum(o[3])]);

export const SUBGROUP_NO = SUBGROUP_NO_NEW;
