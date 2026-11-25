# Chart of accounts: DRAFT for review

*Status: built into the app (new companies start from it; roles, split transactions and payroll entry use it). The accountant questions at the end are still open. Change the chart in scripts/chart-data.mjs.*

## Why a new chart

The old chart (90 accounts, from the Teia workbook) had wrong classifications (withheld tax and the employee's social security as costs, loan repayments as expenses), no logic to its numbering, and one construction-only set of cost accounts for every business. The review that led to this draft is in the conversation. Your own data shows which accounts matter: 57 of the 90 were used in the workbook, mostly materials, fuel, subcontractors, wages and transfers.

## Design in six rules

1. **One structure, five templates.** Every company gets the same spine; a template adds or leaves out the accounts that business needs. The matrix below shows which. C = Construction (Teia Firme), W = Carpentry (Woodgrain), I = Decorations (Algarve Interior), P = Property management (Casas Algarve), K = Client money account.
2. **Our own numbering, nothing official behind it.** This is an internal bookkeeping tool, so the numbers follow our groups. An account number has four digits: the first is the group (1 Income, 2 Cost of sales, 3 Operating expenses, 4 Current assets, 5 Non-current assets, 6 Liabilities, 7 Long-term debt, 8 Equity, 9 Financing and tax), the second is the subgroup within it (11 Revenue, 12 Other income, 13 Interest earned, and so on), and the last two number the account. A heading's number is therefore the start of every account under it.
3. **Three levels stay:** section (a line of the statements) › subgroup › account. Subgroups carry a **role**, and so do a handful of single accounts (below), so the app stops depending on numbers. Renumbering later would then be harmless.
4. **Costs by nature, direct costs separated.** Cost of sales holds materials, subcontractors, direct labour and, for property management, the cleaning, laundry and repairs bought for managed properties. Everything else is an operating expense. The P&L shows gross profit and an operating result as it does now.
5. **Liabilities that are not costs stay out of the P&L.** Withheld tax (6204), social security owed (6205), VAT (6201, 6202), loan principal (6501, 7101) and client money (6402) are balance-sheet accounts.
6. **No manual "current year result" account.** The app calculates it.

## What this draft contains

- 108 accounts in total: Construction 88, Carpentry 90, Decorations 81, Property mgmt 78, Client account 19.
- 29 subgroups in 9 sections.
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
| 4202 | Clients: guarantee retentions held back | ● |  |  |  |  | Builders: part of each stage payment held until the guarantee period ends. |

**Other current assets and VAT recoverable** (debit; role `other_current_assets`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 4301 | Advances, deposits and other debtors | ● | ● | ● | ● |  | Advances to suppliers or staff, deposits paid, tax paid on account, anything owed to us that is not a client. |
| 4302 | VAT recoverable (input VAT) | ● | ● | ● | ● | ● |  |
| 4303 | VAT to be refunded | ● | ● | ● | ● |  |  |
| 4304 | Prepaid expenses | ● | ● | ● | ● |  | For example insurance paid for the whole year. |

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
| 5104 | Office, IT and other equipment (including software) | ● | ● | ● | ● |  |  |

**Accumulated depreciation** (credit; role `accumulated_depreciation`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 5201 | Accumulated depreciation (all fixed assets) *(contra)* | ● | ● | ● | ● |  | One account for the total written off so far. The fixed assets above stay at cost. |

### Liabilities (Balance sheet)

**Suppliers** (credit; role `payables`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6101 | Suppliers (accounts payable) | ● | ● | ● | ● | ● |  |
| 6102 | Suppliers: guarantee retentions withheld | ● |  |  |  |  | Builders: retained from subcontractors until their guarantee ends. |

**VAT and State** (credit; role `state_liabilities`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6201 | VAT charged (output VAT) | ● | ● | ● | ● | ● |  |
| 6202 | VAT payable: settlement account | ● | ● | ● | ● | ● | Payments to the State clear it. |
| 6203 | Corporate income tax payable (IRC) | ● | ● | ● | ● |  |  |
| 6204 | Withheld income tax payable (IRS and IRC withholding) | ● | ● | ● | ● |  | Tax withheld from salaries and from independent professionals. Owed to the State, never a cost. |
| 6205 | Social security payable | ● | ● | ● | ● |  | Employee 11% and employer share, owed to the State. |
| 6206 | Other taxes payable (IMI, stamp duty, municipal) | ● | ● | ● | ● |  |  |

**Staff and accruals** (credit; role `staff_liabilities`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6301 | Salaries payable | ● | ● | ● | ● |  |  |
| 6302 | Accrued holiday and Christmas pay | ● | ● | ● | ● |  | The two extra months of pay built up through the year (duodécimos). |
| 6303 | Other accruals and income received in advance | ● | ● | ● | ● |  | Costs incurred but not yet invoiced (for example interest), and income received before it is earned. |

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
| 6502 | Overdraft, credit cards and other finance | ● | ● | ● | ● |  |  |
| 6503 | Leasing | ● | ● | ● | ● |  |  |
| 6504 | Shareholder loans (suprimentos) | ● | ● | ● | ● |  |  |

### Long-term debt (Balance sheet)

**Borrowings due after a year** (credit; role `long_term_debt`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 7101 | Bank loans: due after a year | ● | ● | ● | ● |  | Own split of the loan so the balance sheet can show current and non-current. |

### Equity (Balance sheet)

**Capital** (credit; role `equity_capital`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 8101 | Share capital and owners' contributions | ● | ● | ● | ● | ● |  |
| 8102 | Partner drawings (advances on profits) *(contra)* | ● | ● | ● | ● |  | Money taken out by the owners; reduces equity. |

**Reserves and retained earnings** (credit; role `retained_earnings`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 8201 | Reserves | ● | ● | ● | ● |  |  |
| 8202 | Retained earnings | ● | ● | ● | ● | ● | The current year's result is calculated by the app and is not an account here. |

### Income (Profit & loss)

**Revenue** (credit; role `revenue`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 1101 | Sales of goods and materials | ● | ● | ● |  |  |  |
| 1102 | Sales of made-to-order joinery (kitchens, wardrobes, doors) |  | ● |  |  |  |  |
| 1103 | Construction works (including labour and site supervision) | ● |  |  |  |  |  |
| 1104 | Design and project management | ● |  |  |  |  |  |
| 1105 | Installation and fitting |  | ● | ● |  |  |  |
| 1106 | Repairs and restoration |  | ● |  |  |  |  |
| 1107 | Design and consultancy fees |  |  | ● |  |  |  |
| 1108 | Styling and staging |  |  | ● |  |  |  |
| 1109 | Management commissions |  |  |  | ● |  |  |
| 1110 | Guest services, maintenance coordination and inspections |  |  |  | ● |  |  |
| 1111 | Rental income from own properties |  |  |  | ● |  |  |
| 1112 | Account administration fees |  |  |  |  | ● |  |
| 1113 | Discounts and returns allowed *(contra)* | ● | ● | ● | ● | ● | Credit notes can post here. |

**Other income and gains** (credit; role `other_income`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 1201 | Recharged costs to clients | ● | ● | ● | ● |  |  |
| 1202 | Other income and gains (grants, insurance claims, asset sales, bad debts recovered) | ● | ● | ● | ● | ● |  |

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
| 2107 | Purchase returns and discounts *(contra)* | ● | ● | ● |  |  | Goods sent back to a supplier, or a discount the supplier gives after the invoice. Reduces the cost of materials. |

**Subcontractors and direct services** (debit; role `cost_direct_services`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2201 | Subcontractors (trades) | ● | ● | ● |  |  |  |
| 2202 | Specialist and design services | ● | ● | ● |  |  |  |
| 2203 | Equipment and plant hire for jobs | ● | ● |  |  |  |  |
| 2204 | Small tools and consumables | ● | ● | ● | ● |  |  |
| 2205 | Other direct job costs (skips, waste, deliveries) | ● | ● | ● |  |  |  |
| 2206 | Cleaning and laundry for managed properties |  |  |  | ● |  |  |
| 2207 | Pool and garden maintenance |  |  |  | ● |  |  |
| 2208 | Repairs and maintenance of managed properties |  |  |  | ● |  |  |
| 2209 | Booking-platform commissions |  |  |  | ● |  |  |

**Direct labour** (debit; role `cost_direct_labour`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2301 | Wages: site and workshop staff | ● | ● |  |  |  |  |
| 2302 | Employer social security: direct staff | ● | ● |  |  |  |  |
| 2303 | Insurance and training: direct staff | ● | ● |  |  |  |  |

### Operating expenses (Profit & loss)

**Staff costs: office and management** (debit; role `opex_staff`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3101 | Management remuneration | ● | ● | ● | ● |  |  |
| 3102 | Wages: office staff | ● | ● | ● | ● |  |  |
| 3103 | Employer social security: office staff and management | ● | ● | ● | ● |  |  |
| 3104 | Other staff costs (insurance, welfare, training) | ● | ● | ● | ● |  |  |

**Premises and utilities** (debit; role `opex_premises`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3201 | Rent of premises | ● | ● | ● | ● |  |  |
| 3202 | Electricity and water | ● | ● | ● | ● |  |  |
| 3203 | Telephone and internet | ● | ● | ● | ● |  |  |
| 3204 | Repairs and maintenance of premises | ● | ● | ● | ● |  |  |
| 3205 | Cleaning and hygiene of premises | ● | ● | ● | ● |  |  |

**Vehicles and travel** (debit; role `opex_vehicles`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3301 | Fuel | ● | ● | ● | ● |  |  |
| 3302 | Vehicle repairs, servicing and inspections | ● | ● | ● | ● |  |  |
| 3303 | Tolls, parking and travel | ● | ● | ● | ● |  |  |
| 3304 | Insurance: vehicles | ● | ● | ● | ● |  |  |

**Professional and administrative** (debit; role `opex_admin`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3401 | Accounting, legal and professional fees | ● | ● | ● | ● | ● |  |
| 3402 | Office supplies and printing | ● | ● | ● | ● |  |  |
| 3403 | Software, subscriptions and web services | ● | ● | ● | ● |  |  |
| 3404 | Insurance: business, liability and contract works | ● | ● | ● | ● |  |  |
| 3405 | Advertising and marketing | ● | ● | ● | ● |  |  |
| 3406 | Commissions paid to agents | ● | ● | ● | ● |  |  |
| 3407 | Meals, entertainment and gifts | ● | ● | ● | ● |  |  |
| 3408 | Bank charges and commissions | ● | ● | ● | ● | ● |  |
| 3409 | Other external services | ● | ● | ● | ● | ● |  |

**Taxes and licences** (debit; role `opex_taxes`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3501 | Vehicle and property taxes (IUC, IMI) | ● | ● | ● | ● |  |  |
| 3502 | Stamp duty, fees, licences and permits | ● | ● | ● | ● |  |  |

**Depreciation** (debit; role `depreciation`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3601 | Depreciation (all fixed assets) | ● | ● | ● | ● |  | One account for the year's depreciation of every fixed asset. |

**Other expenses and losses** (debit; role `other_expense`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3701 | Bad debts written off | ● | ● | ● | ● |  |  |
| 3702 | Stock losses | ● | ● | ● |  |  |  |
| 3703 | Donations and memberships | ● | ● | ● | ● |  |  |
| 3704 | Other expenses and losses (including losses on asset sales) | ● | ● | ● | ● | ● |  |

### Financing and tax (Profit & loss)

**Financing costs** (debit; role `interest_expense`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 9101 | Interest on bank loans | ● | ● | ● | ● |  |  |
| 9102 | Other interest and finance costs (overdraft, leasing, cards, loan fees) | ● | ● | ● | ● |  |  |

**Income tax** (debit; role `income_tax`)

| No. | Name | C | W | I | P | K | Note |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 9201 | Corporate income tax (IRC) for the year | ● | ● | ● | ● |  |  |


## Accounts the app will use by role

| Role | Account | What the app does with it |
|---|---|---|
| `petty_cash` | 4101 | Default petty cash |
| `transfers_clearing` | 4106 | Both sides of a transfer between own accounts |
| `accounts_receivable` | 4201 | Debited by invoices, credited by payments received |
| `vat_input` | 4302 | VAT paid on purchases |
| `accounts_payable` | 6101 | Credited by purchase invoices, debited by payments made |
| `vat_output` | 6201 | VAT charged on sales |
| `vat_settlement` | 6202 | IVA paid to or refunded by the State |
| `withholding_payable` | 6204 | Tax withheld from pay, until paid to the State |
| `social_security_payable` | 6205 | Social security, until paid |
| `net_pay_payable` | 6301 | Net pay owed to staff, until paid |
| `holiday_accrual` | 6302 | Monthly build-up of holiday and Christmas pay |
| `client_money` | 6402 | Money held for owners (Property management, Client account) |
| `loan_principal` | 6501 | Loan repayments reduce this account (the Loan instalment split) |
| `share_capital` | 8101 | Where an opening balance for bank accounts is set against |
| `retained_earnings` | 8202 | Profit kept from earlier years |
| `default_sales` | 1102, 1103, 1107, 1109, 1112 | Default account on a new sales invoice (one per business) |
| `interest_income` | 1301 | Interest earned |
| `default_materials` | 2101 | Default account on a new purchase invoice |
| `stock_change` | 2106 |  |
| `wages_direct` | 2301 | Gross pay of site and workshop staff |
| `employer_social_security_direct` | 2302 | Employer social security on direct staff |
| `wages_office` | 3102 | Gross pay of office staff |
| `employer_social_security_office` | 3103 | Employer social security on office staff |
| `bank_charges` | 3408 | Bank fees (the Loan instalment split) |
| `interest_expense` | 9101 | Interest cover on the dashboard |
| `income_tax` | 9201 | Tax on profits |

## How payroll would post (the next change, once the chart is agreed)

One payroll entry per person per month, instead of single-account bank lines:

| | Debit | Credit |
|---|---|---|
| Gross pay | 2301 or 3102 | |
| Employer social security (about 23.75%) | 2302 or 3103 | |
| Net pay to the employee | | 6301 |
| Tax withheld (IRS) | | 6204 |
| Social security: employee share and employer share | | 6205 |
| Holiday and Christmas pay as duodecimos (a twelfth of each paid with the monthly salary) | 2301 or 3102, part of the gross | none needed |
| Paying the net pay | 6301 | bank |
| Paying the State | 6204, 6205 | bank |

## Questions for you and your accountant

1. ANSWERED (Tony, 2026-11-25): no SAF-T reporting; the app is for management use. The chart uses our own numbering.
2. ANSWERED: autonomous taxation is handled by the external accountants, so there is no account for it (8123 removed).
3. ANSWERED: sub-account numbers as drafted.
4. ANSWERED: retentions yes (4202, 6102 stay in the Construction template); no work in progress removed.
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
