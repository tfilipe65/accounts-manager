# Chart of accounts: DRAFT for review

*Status: built into the app (new companies start from it; roles, split transactions and payroll entry use it). The accountant questions at the end are still open. Change the chart in scripts/chart-data.mjs.*

## Why a new chart

The old chart (90 accounts, from the Teia workbook) had wrong classifications (withheld tax and the employee's social security as costs, loan repayments as expenses), no logic to its numbering, and one construction-only set of cost accounts for every business. The review that led to this draft is in the conversation. Your own data shows which accounts matter: 57 of the 90 were used in the workbook, mostly materials, fuel, subcontractors, wages and transfers.

## Design in six rules

1. **One structure, five templates.** Every company gets the same spine; a template adds or leaves out the accounts that business needs. The matrix below shows which. C = Construction (Teia Firme), W = Carpentry (Woodgrain), I = Decorations (Algarve Interior), P = Property management (Casas Algarve), K = Client money account.
2. **Our own numbering, nothing official behind it.** This is an internal bookkeeping tool, so the numbers follow our groups. An account number has four digits: the first is the group (1 Income, 2 Cost of sales, 3 Operating expenses, 4 Current assets, 5 Non-current assets, 6 Liabilities, 7 Long-term debt, 8 Equity, 9 Financing and tax), the second is the subgroup within it (11 Revenue, 12 Other income, 13 Interest earned, and so on), and the last two number the account. A heading's number is therefore the start of every account under it.
3. **Three levels stay:** section (a line of the statements) › subgroup › account. Subgroups carry a **role**, and so do a handful of single accounts (below), so the app stops depending on numbers. Renumbering later would then be harmless.
4. **Costs by nature, direct costs separated.** Cost of sales holds materials, subcontractors, direct labour and, for property management, the cleaning, laundry and repairs bought for managed properties. Everything else is an operating expense. The P&L shows gross profit and an operating result as it does now.
5. **Liabilities that are not costs stay out of the P&L.** Withheld tax (6202), social security owed (6206), VAT (6203, 6204), loan principal (6501, 7101) and client money (6402) are balance-sheet accounts.
6. **No manual "current year result" account.** The app calculates it.

## What this draft contains

- 155 accounts in total: Construction 133, Carpentry 133, Decorations 120, Property mgmt 117, Client account 19.
- 30 subgroups in 9 sections.
- Every one of the 90 current accounts is mapped to a new one (or dropped with a reason): `chart-old-to-new-DRAFT.csv`.
- The same chart for Excel, with a column per template: `chart-of-accounts-DRAFT.csv`.

## The chart

Legend: ● the account is in that business's template.

### Current assets (Balance sheet)

**Cash and bank** (debit; role `cash`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 4101 | Petty cash | ● | ● | ● | ● |  |  |
| 4102 | Bank account 1: current account | ● | ● | ● | ● | ● | Further bank accounts added in the app take the next free number in this subgroup. |
| 4103 | Bank account 2: IVA and tax reserve | ● | ● | ● | ● |  |  |
| 4104 | Bank account 3 | ● | ● | ● | ● |  |  |
| 4105 | Payment platforms to collect (card terminals, booking payouts) |  |  |  | ● |  |  |
| 4106 | Transfers between own accounts (clearing) | ● | ● | ● | ● | ● | Always nets to zero; shown so a missing side of a transfer is visible. |

**Clients** (debit; role `receivables`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 4201 | Clients (accounts receivable) | ● | ● | ● | ● | ● |  |
| 4202 | Doubtful clients | ● | ● | ● | ● |  |  |
| 4203 | Clients: guarantee retentions held back | ● |  |  |  |  | Builders: part of each stage payment held until the guarantee period ends. |

**Other current assets and VAT recoverable** (debit; role `other_current_assets`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 4301 | Advances to suppliers | ● | ● | ● | ● |  |  |
| 4302 | Advances to staff | ● | ● | ● | ● |  |  |
| 4303 | IRC paid on account | ● | ● | ● | ● |  |  |
| 4304 | VAT recoverable (input VAT) | ● | ● | ● | ● | ● |  |
| 4305 | VAT to be refunded | ● | ● | ● | ● |  |  |
| 4306 | Accrued income | ● | ● | ● | ● |  |  |
| 4307 | Other debtors | ● | ● | ● | ● |  |  |
| 4308 | Deposits and guarantees paid | ● | ● | ● | ● |  |  |
| 4309 | Prepaid expenses | ● | ● | ● | ● |  | For example insurance paid for the whole year. |

**Stock** (debit; role `inventory`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 4401 | Goods and materials in stock | ● | ● |  |  |  |  |

### Non-current assets (Balance sheet)

**Fixed assets (cost)** (debit; role `fixed_assets`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 5101 | Buildings and improvements | ● | ● | ● |  |  |  |
| 5102 | Plant, machinery and tools | ● | ● |  |  |  |  |
| 5103 | Motor vehicles | ● | ● | ● | ● |  |  |
| 5104 | Office and IT equipment | ● | ● | ● | ● |  |  |
| 5105 | Other tangible assets | ● | ● | ● | ● |  |  |
| 5106 | Software and intangible assets | ● | ● | ● | ● |  |  |

**Accumulated depreciation** (credit; role `accumulated_depreciation`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 5201 | Accumulated depreciation: buildings *(contra)* | ● | ● | ● |  |  |  |
| 5202 | Accumulated depreciation: plant and machinery *(contra)* | ● | ● |  |  |  |  |
| 5203 | Accumulated depreciation: vehicles *(contra)* | ● | ● | ● | ● |  |  |
| 5204 | Accumulated depreciation: office and IT *(contra)* | ● | ● | ● | ● |  |  |
| 5205 | Accumulated depreciation: other *(contra)* | ● | ● | ● | ● |  |  |
| 5206 | Accumulated amortisation: intangibles *(contra)* | ● | ● | ● | ● |  |  |

**Other non-current assets** (debit; role `other_noncurrent`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 5301 | Long-term investments and deposits | ● | ● | ● | ● |  |  |

### Liabilities (Balance sheet)

**Suppliers** (credit; role `payables`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6101 | Suppliers (accounts payable) | ● | ● | ● | ● | ● |  |
| 6102 | Suppliers: guarantee retentions withheld | ● |  |  |  |  | Builders: retained from subcontractors until their guarantee ends. |
| 6103 | Suppliers of fixed assets | ● | ● | ● | ● |  |  |

**VAT and State** (credit; role `state_liabilities`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6201 | IRC: estimated tax payable | ● | ● | ● | ● |  |  |
| 6202 | Withheld income tax payable (IRS and IRC withholding) | ● | ● | ● | ● |  | Tax withheld from salaries and from independent professionals. Owed to the State, never a cost. |
| 6203 | VAT charged (output VAT) | ● | ● | ● | ● | ● |  |
| 6204 | VAT payable: settlement account | ● | ● | ● | ● | ● | Replaces the old 'IVA paid / received' account. Payments to the State clear it. |
| 6205 | Other taxes payable (IMI, stamp duty, municipal) | ● | ● | ● | ● |  |  |
| 6206 | Social security payable | ● | ● | ● | ● |  | Employee 11% and employer share, owed to the State. |

**Staff and accruals** (credit; role `staff_liabilities`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6301 | Salaries payable | ● | ● | ● | ● |  |  |
| 6302 | Accrued holiday and Christmas pay | ● | ● | ● | ● |  | The two extra months of pay built up through the year. |
| 6303 | Other accrued costs | ● | ● | ● | ● |  |  |
| 6304 | Deferred income | ● | ● | ● | ● |  |  |

**Customer money and deposits** (credit; role `customer_funds`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6401 | Customer advances and deposits | ● | ● | ● |  |  |  |
| 6402 | Client money held for owners |  |  |  | ● | ● | Property management: rent collected and held for owners. |
| 6403 | Guest and tenant deposits held |  |  |  | ● | ● |  |

**Borrowings due within a year** (credit; role `short_term_debt`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6501 | Bank loans: due within a year | ● | ● | ● | ● |  |  |
| 6502 | Bank overdraft | ● | ● | ● | ● |  |  |
| 6503 | Leasing | ● | ● | ● | ● |  |  |
| 6504 | Credit cards and other financing | ● | ● | ● | ● |  |  |
| 6505 | Shareholder loans (suprimentos) | ● | ● | ● | ● |  |  |

### Long-term debt (Balance sheet)

**Borrowings due after a year** (credit; role `long_term_debt`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 7101 | Bank loans: due after a year | ● | ● | ● | ● |  | Own split of 251 so the balance sheet can show current and non-current. |

### Equity (Balance sheet)

**Capital** (credit; role `equity_capital`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 8101 | Partner drawings (advances on profits) *(contra)* | ● | ● | ● | ● |  | Money taken out by the owners; reduces equity. |
| 8102 | Share capital | ● | ● | ● | ● | ● |  |
| 8103 | Additional capital contributions | ● | ● | ● | ● |  |  |

**Reserves and retained earnings** (credit; role `retained_earnings`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 8201 | Legal reserve | ● | ● | ● | ● |  |  |
| 8202 | Other reserves | ● | ● | ● | ● |  |  |
| 8203 | Retained earnings | ● | ● | ● | ● | ● | The current year's result is calculated by the app and is not an account here. |

### Income (Profit & loss)

**Revenue** (credit; role `revenue`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 1101 | Sales of goods and materials | ● | ● | ● |  |  |  |
| 1102 | Sales of made-to-order joinery (kitchens, wardrobes, doors) |  | ● |  |  |  |  |
| 1103 | Discounts and returns allowed *(contra)* | ● | ● | ● | ● | ● | Credit notes can post here. |
| 1104 | Construction works | ● |  |  |  |  |  |
| 1105 | Labour and site supervision | ● |  |  |  |  |  |
| 1106 | Design and project management | ● |  |  |  |  |  |
| 1107 | Installation and fitting |  | ● | ● |  |  |  |
| 1108 | Repairs and restoration |  | ● |  |  |  |  |
| 1109 | Design and consultancy fees |  |  | ● |  |  |  |
| 1110 | Styling and staging |  |  | ● |  |  |  |
| 1111 | Management commissions |  |  |  | ● |  |  |
| 1112 | Guest services (check-in, linen, concierge) |  |  |  | ● |  |  |
| 1113 | Maintenance coordination fees |  |  |  | ● |  |  |
| 1114 | Rental income from own properties |  |  |  | ● |  |  |
| 1115 | Inspections and reports |  |  |  | ● |  |  |
| 1116 | Account administration fees |  |  |  |  | ● |  |

**Other income and gains** (credit; role `other_income`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 1201 | Operating grants | ● | ● | ● | ● |  |  |
| 1202 | Recharged costs and supplementary income | ● | ● | ● | ● |  |  |
| 1203 | Early-payment discounts received | ● | ● | ● | ● |  |  |
| 1204 | Recovered bad debts | ● | ● | ● | ● |  |  |
| 1205 | Insurance claims received | ● | ● | ● | ● |  |  |
| 1206 | Gains on disposal of assets | ● | ● | ● | ● |  |  |
| 1207 | Other income and gains | ● | ● | ● | ● | ● |  |

**Interest earned** (credit; role `interest_income`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 1301 | Interest earned | ● | ● | ● | ● | ● |  |

### Cost of sales (direct costs) (Profit & loss)

**Materials and goods** (debit; role `cost_materials`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2101 | Materials and goods used | ● | ● | ● |  |  |  |
| 2102 | Timber and boards |  | ● |  |  |  |  |
| 2103 | Hardware and fittings |  | ● |  |  |  |  |
| 2104 | Finishes (varnish, paint, glue) |  | ● |  |  |  |  |
| 2105 | Furnishings and soft goods for resale |  |  | ● |  |  |  |
| 2106 | Change in stock (year-end count) | ● | ● |  |  |  | Posted by Year-End Stock: the closing count on 31 Dec, reversed on 1 Jan. |
| 2107 | Purchase returns and discounts *(contra)* | ● | ● | ● |  |  |  |

**Subcontractors and direct services** (debit; role `cost_direct_services`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2201 | Subcontractors (trades) | ● | ● | ● |  |  |  |
| 2202 | Specialist and design services | ● | ● | ● |  |  |  |
| 2203 | Equipment and plant hire for jobs | ● | ● |  |  |  |  |
| 2204 | Skip hire and waste removal | ● |  |  |  |  |  |
| 2205 | Site consumables and small tools | ● | ● |  |  |  |  |
| 2206 | Other direct job costs | ● | ● | ● |  |  |  |
| 2207 | Cleaning and laundry for managed properties |  |  |  | ● |  |  |
| 2208 | Pool and garden maintenance |  |  |  | ● |  |  |
| 2209 | Repairs and maintenance of managed properties |  |  |  | ● |  |  |
| 2210 | Booking-platform commissions |  |  |  | ● |  |  |

**Direct labour** (debit; role `cost_direct_labour`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2301 | Wages: site and workshop staff | ● | ● |  |  |  |  |
| 2302 | Employer social security: direct staff | ● | ● |  |  |  |  |
| 2303 | Work-accident insurance: direct staff | ● | ● |  |  |  |  |
| 2304 | Health and safety, training: direct staff | ● | ● |  |  |  |  |

### Operating expenses (Profit & loss)

**Staff costs: office and management** (debit; role `opex_staff`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3101 | Management remuneration | ● | ● | ● | ● |  |  |
| 3102 | Wages: office staff | ● | ● | ● | ● |  |  |
| 3103 | Employer social security: office staff | ● | ● | ● | ● |  |  |
| 3104 | Employer social security: management | ● | ● | ● | ● |  |  |
| 3105 | Work-accident insurance: office staff | ● | ● | ● | ● |  |  |
| 3106 | Staff health insurance and welfare | ● | ● | ● | ● |  |  |
| 3107 | Training and other staff costs | ● | ● | ● | ● |  |  |

**Premises and utilities** (debit; role `opex_premises`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3201 | Repairs and maintenance of premises | ● | ● | ● | ● |  |  |
| 3202 | Electricity | ● | ● | ● | ● |  |  |
| 3203 | Water | ● | ● | ● | ● |  |  |
| 3204 | Rent of premises | ● | ● | ● | ● |  |  |
| 3205 | Telephone and internet | ● | ● | ● | ● |  |  |
| 3206 | Cleaning and hygiene of premises | ● | ● | ● | ● |  |  |

**Vehicles and travel** (debit; role `opex_vehicles`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3301 | Vehicle repairs, servicing and inspections | ● | ● | ● | ● |  |  |
| 3302 | Fuel | ● | ● | ● | ● |  |  |
| 3303 | Travel and accommodation | ● | ● | ● | ● |  |  |
| 3304 | Tolls and parking | ● | ● | ● | ● |  |  |
| 3305 | Insurance: vehicles | ● | ● | ● | ● |  |  |

**Professional and administrative** (debit; role `opex_admin`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3401 | Advertising and marketing | ● | ● | ● | ● |  |  |
| 3402 | Accounting and professional fees | ● | ● | ● | ● | ● |  |
| 3403 | Commissions paid to agents | ● | ● | ● | ● |  |  |
| 3404 | Small tools and equipment (expensed) | ● | ● | ● | ● |  |  |
| 3405 | Office supplies and printing | ● | ● | ● | ● |  |  |
| 3406 | Gifts and samples | ● | ● | ● | ● |  |  |
| 3407 | Legal and notary fees | ● | ● | ● | ● |  |  |
| 3408 | Meals and entertainment | ● | ● | ● | ● |  |  |
| 3409 | Other external services | ● | ● | ● | ● | ● |  |
| 3410 | Insurance: business, liability and contract works | ● | ● | ● | ● |  |  |
| 3411 | Bank charges and commissions | ● | ● | ● | ● | ● |  |
| 3412 | Software, subscriptions and web services | ● | ● | ● | ● |  |  |

**Taxes and licences** (debit; role `opex_taxes`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3501 | Vehicle and property taxes (IUC, IMI) | ● | ● | ● | ● |  |  |
| 3502 | Stamp duty and indirect taxes | ● | ● | ● | ● |  |  |
| 3503 | Fees, licences and permits | ● | ● | ● | ● |  |  |

**Depreciation** (debit; role `depreciation`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3601 | Depreciation: buildings and improvements | ● | ● | ● |  |  |  |
| 3602 | Depreciation: plant and machinery | ● | ● |  |  |  |  |
| 3603 | Depreciation: vehicles | ● | ● | ● | ● |  |  |
| 3604 | Depreciation: office and IT equipment | ● | ● | ● | ● |  |  |
| 3605 | Depreciation: other tangible assets | ● | ● | ● | ● |  |  |
| 3606 | Amortisation: software and intangibles | ● | ● | ● | ● |  |  |

**Other expenses and losses** (debit; role `other_expense`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3701 | Bad debts written off | ● | ● | ● | ● |  |  |
| 3702 | Stock losses | ● | ● | ● |  |  |  |
| 3703 | Prior-period corrections | ● | ● | ● | ● |  |  |
| 3704 | Donations | ● | ● | ● | ● |  |  |
| 3705 | Memberships (associations) | ● | ● | ● | ● |  |  |
| 3706 | Losses on disposal of assets | ● | ● | ● | ● |  |  |
| 3707 | Other expenses and losses | ● | ● | ● | ● | ● |  |

### Financing and tax (Profit & loss)

**Financing costs** (debit; role `interest_expense`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 9101 | Interest on bank loans | ● | ● | ● | ● |  |  |
| 9102 | Interest on overdraft, leasing and cards | ● | ● | ● | ● |  |  |
| 9103 | Loan arrangement fees and other financing costs | ● | ● | ● | ● |  |  |

**Income tax** (debit; role `income_tax`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 9201 | IRC: estimated tax for the year | ● | ● | ● | ● |  |  |


## Accounts the app will use by role

| Role | Account | What the app does with it |
|---|---|---|
| `petty_cash` | 4101 | Default petty cash |
| `transfers_clearing` | 4106 | Both sides of a transfer between own accounts |
| `accounts_receivable` | 4201 | Debited by invoices, credited by payments received |
| `vat_input` | 4304 | VAT paid on purchases |
| `accounts_payable` | 6101 | Credited by purchase invoices, debited by payments made |
| `vat_output` | 6203 | VAT charged on sales |
| `vat_settlement` | 6204 | IVA paid to or refunded by the State |
| `withholding_payable` | 6202 | Tax withheld from pay, until paid to the State |
| `social_security_payable` | 6206 | Social security, until paid |
| `net_pay_payable` | 6301 | Net pay owed to staff, until paid |
| `holiday_accrual` | 6302 | Monthly build-up of holiday and Christmas pay |
| `client_money` | 6402 | Money held for owners (Property management, Client account) |
| `loan_principal` | 6501 | Loan repayments reduce this account (the Loan instalment split) |
| `share_capital` | 8102 | Where an opening balance for bank accounts is set against |
| `retained_earnings` | 8203 | Profit kept from earlier years |
| `default_sales` | 1102, 1104, 1109, 1111, 1116 | Default account on a new sales invoice (one per business) |
| `interest_income` | 1301 | Interest earned |
| `default_materials` | 2101 | Default account on a new purchase invoice |
| `stock_change` | 2106 |  |
| `wages_direct` | 2301 | Gross pay of site and workshop staff |
| `employer_social_security_direct` | 2302 | Employer social security on direct staff |
| `wages_office` | 3102 | Gross pay of office staff |
| `employer_social_security_office` | 3103 | Employer social security on office staff |
| `bank_charges` | 3411 | Bank fees (the Loan instalment split) |
| `interest_expense` | 9101 | Interest cover on the dashboard |
| `income_tax` | 9201 | Tax on profits |

## How payroll would post (the next change, once the chart is agreed)

One payroll entry per person per month, instead of single-account bank lines:

| | Debit | Credit |
|---|---|---|
| Gross pay | 2301 or 3102 | |
| Employer social security (about 23.75%) | 2302 or 3103 | |
| Net pay to the employee | | 6301 |
| Tax withheld (IRS) | | 6202 |
| Social security: employee share and employer share | | 6206 |
| Holiday and Christmas pay as duodecimos (a twelfth of each paid with the monthly salary) | 2301 or 3102, part of the gross | none needed |
| Paying the net pay | 6301 | bank |
| Paying the State | 6202, 6206 | bank |

## Questions for you and your accountant

1. ANSWERED (Tony, 2026-11-25): no SAF-T reporting; the app is for management use. The chart uses our own numbering.
2. ANSWERED: autonomous taxation is handled by the external accountants, so there is no account for it (8123 removed).
3. ANSWERED: sub-account numbers as drafted.
4. ANSWERED: retentions yes (4203, 6102 stay in the Construction template); no work in progress removed.
5. ANSWERED: client money exists only in Casas Algarve and the Client Account company; Teia, Woodgrain and Algarve Interior do not use it (6402 stays in templates P and K only).
6. ANSWERED: stock for Teia and Woodgrain only (4401 stays in C and W, removed from I, P, K).
7. ANSWERED: monthly for some companies and quarterly for others (a setting per company); non-deductible VAT is left to the external accountants.
8. OPEN: Tony will check once the last changes are in and the sample data has run.

## What happens if you approve

1. I turn this data into the seed for each company and give subgroups and accounts their roles.
2. The app's code switches from hard-coded numbers to roles (the work I skipped over before).
3. Payroll entry and the VAT-on-direct-entries fix follow.
4. The sample data is rebuilt on the new chart.

Because you will start fresh, nothing has to be converted.
