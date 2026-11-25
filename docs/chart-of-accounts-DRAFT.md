# Chart of accounts: DRAFT for review

*Status: built into the app (new companies start from it; roles, split transactions and payroll entry use it). The accountant questions at the end are still open. Change the chart in scripts/chart-data.mjs.*

## Why a new chart

The current chart (90 accounts, from the Teia workbook) has wrong classifications (withheld tax and the employee's social security as costs, loan repayments as expenses), no logic to its numbering, one construction-only set of cost accounts for every business, and no link to the Portuguese official chart. The review that led to this draft is in the conversation. Your own data shows which accounts matter: 57 of the 90 were used in the workbook, mostly materials, fuel, subcontractors, wages and transfers.

## Design in six rules

1. **One structure, five templates.** Every company gets the same spine; a template adds or leaves out the accounts that business needs. The matrix below shows which. C = Construction (Teia Firme), W = Carpentry (Woodgrain), I = Decorations (Algarve Interior), P = Property management (Casas Algarve), K = Client money account.
2. **The account number is the SNC number.** SNC (Sistema de Normalização Contabilística) is the Portuguese official chart: 1 cash and bank, 2 receivables, payables, State and financing, 3 stock, 4 fixed assets, 5 equity, 6 costs, 7 income, 8 results. Using its numbers means your accountant, and the tax authority's SAF-T file, need no translation. Where SNC has only three digits and we need more detail, we add a digit (a *sub-account*, marked ›). Anything I am not sure of is flagged ⚑ for your accountant.
3. **Three levels stay:** section (a line of the statements) › subgroup › account. Subgroups carry a **role**, and so do a handful of single accounts (below), so the app stops depending on numbers. Renumbering later would then be harmless.
4. **Costs by nature, direct costs separated.** Cost of sales holds materials, subcontractors, direct labour and, for property management, the cleaning, laundry and repairs bought for managed properties. Everything else is an operating expense. The P&L shows gross profit and an operating result as it does now.
5. **Liabilities that are not costs stay out of the P&L.** Withheld tax (2421), social security owed (2451), VAT (2433, 2436), loan principal (2511, 2514) and client money (2788) are balance-sheet accounts.
6. **No manual "current year result" account.** The app calculates it.

## What this draft contains

- 155 accounts in total: Construction 133, Carpentry 133, Decorations 120, Property mgmt 117, Client account 19.
- 30 subgroups in 9 sections.
- Every one of the 90 current accounts is mapped to a new one (or dropped with a reason): `chart-old-to-new-DRAFT.csv`.
- The same chart for Excel, with a column per template: `chart-of-accounts-DRAFT.csv`.

## The chart

Legend: ● in the template; › our own sub-account of the SNC account; ⚑ to be confirmed with your accountant.

### Current assets (Balance sheet)

**Cash and bank** (debit; role `cash`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 1110 | Petty cash | 11 | ● | ● | ● | ● |  |  |
| 1210 | Bank account 1: current account | 12 | ● | ● | ● | ● | ● | Account 3 is 1230; further bank accounts added in the app take the next free number up to 1289. |
| 1220 | Bank account 2: IVA and tax reserve | 12 | ● | ● | ● | ● |  |  |
| 1230 | Bank account 3 | 12 | ● | ● | ● | ● |  |  |
| 1240 | Payment platforms to collect (card terminals, booking payouts) | 12 ⚑ |  |  |  | ● |  |  |
| 1290 | Transfers between own accounts (clearing) | 12 › | ● | ● | ● | ● | ● | Always nets to zero; shown so a missing side of a transfer is visible. |

**Clients** (debit; role `receivables`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2110 | Clients (accounts receivable) | 211 | ● | ● | ● | ● | ● |  |
| 2118 | Doubtful clients | 218 | ● | ● | ● | ● |  |  |
| 2119 | Clients: guarantee retentions held back | 211 › | ● |  |  |  |  | Builders: part of each stage payment held until the guarantee period ends. |

**Other current assets and VAT recoverable** (debit; role `other_current_assets`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2250 | Advances to suppliers | 225 | ● | ● | ● | ● |  |  |
| 2321 | Advances to staff | 232 | ● | ● | ● | ● |  |  |
| 2411 | IRC paid on account | 2411 ⚑ | ● | ● | ● | ● |  | Sub-account number to be confirmed. |
| 2432 | VAT recoverable (input VAT) | 2432 | ● | ● | ● | ● | ● |  |
| 2437 | VAT to be refunded | 2437 | ● | ● | ● | ● |  |  |
| 2721 | Accrued income | 2721 | ● | ● | ● | ● |  |  |
| 2781 | Other debtors | 278 | ● | ● | ● | ● |  |  |
| 2784 | Deposits and guarantees paid | 278 › | ● | ● | ● | ● |  |  |
| 2811 | Prepaid expenses | 281 | ● | ● | ● | ● |  | For example insurance paid for the whole year. |

**Stock** (debit; role `inventory`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 3210 | Goods and materials in stock | 32/33 | ● | ● |  |  |  |  |

### Non-current assets (Balance sheet)

**Fixed assets (cost)** (debit; role `fixed_assets`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 4320 | Buildings and improvements | 432 | ● | ● | ● |  |  |  |
| 4330 | Plant, machinery and tools | 433 | ● | ● |  |  |  |  |
| 4340 | Motor vehicles | 434 | ● | ● | ● | ● |  |  |
| 4350 | Office and IT equipment | 435 | ● | ● | ● | ● |  |  |
| 4370 | Other tangible assets | 437 | ● | ● | ● | ● |  |  |
| 4410 | Software and intangible assets | 44 | ● | ● | ● | ● |  |  |

**Accumulated depreciation** (credit; role `accumulated_depreciation`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 4822 | Accumulated depreciation: buildings *(contra)* | 4822 | ● | ● | ● |  |  |  |
| 4823 | Accumulated depreciation: plant and machinery *(contra)* | 4823 | ● | ● |  |  |  |  |
| 4824 | Accumulated depreciation: vehicles *(contra)* | 4824 | ● | ● | ● | ● |  |  |
| 4825 | Accumulated depreciation: office and IT *(contra)* | 4825 | ● | ● | ● | ● |  |  |
| 4827 | Accumulated depreciation: other *(contra)* | 4827 | ● | ● | ● | ● |  |  |
| 4841 | Accumulated amortisation: intangibles *(contra)* | 484 | ● | ● | ● | ● |  |  |

**Other non-current assets** (debit; role `other_noncurrent`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 4110 | Long-term investments and deposits | 41 | ● | ● | ● | ● |  |  |

### Liabilities (Balance sheet)

**Suppliers** (credit; role `payables`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2210 | Suppliers (accounts payable) | 221 | ● | ● | ● | ● | ● |  |
| 2212 | Suppliers: guarantee retentions withheld | 221 › | ● |  |  |  |  | Builders: retained from subcontractors until their guarantee ends. |
| 2710 | Suppliers of fixed assets | 271 | ● | ● | ● | ● |  |  |

**VAT and State** (credit; role `state_liabilities`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2414 | IRC: estimated tax payable | 2414 ⚑ | ● | ● | ● | ● |  | Sub-account number to be confirmed. |
| 2421 | Withheld income tax payable (IRS and IRC withholding) | 2421/2422 ⚑ | ● | ● | ● | ● |  | Tax withheld from salaries and from independent professionals. Owed to the State, never a cost. |
| 2433 | VAT charged (output VAT) | 2433 | ● | ● | ● | ● | ● |  |
| 2436 | VAT payable: settlement account | 2436 | ● | ● | ● | ● | ● | Replaces the old 'IVA paid / received' account. Payments to the State clear it. |
| 2441 | Other taxes payable (IMI, stamp duty, municipal) | 244 | ● | ● | ● | ● |  |  |
| 2451 | Social security payable | 245 | ● | ● | ● | ● |  | Employee 11% and employer share, owed to the State. |

**Staff and accruals** (credit; role `staff_liabilities`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2311 | Salaries payable | 231 | ● | ● | ● | ● |  |  |
| 2722 | Accrued holiday and Christmas pay | 2722 | ● | ● | ● | ● |  | The two extra months of pay built up through the year. |
| 2723 | Other accrued costs | 2722 › | ● | ● | ● | ● |  |  |
| 2821 | Deferred income | 282 | ● | ● | ● | ● |  |  |

**Customer money and deposits** (credit; role `customer_funds`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2761 | Customer advances and deposits | 276 | ● | ● | ● |  |  |  |
| 2788 | Client money held for owners | 278 › |  |  |  | ● | ● | Property management: rent collected and held for owners. |
| 2789 | Guest and tenant deposits held | 278 › |  |  |  | ● | ● |  |

**Borrowings due within a year** (credit; role `short_term_debt`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2511 | Bank loans: due within a year | 2511 | ● | ● | ● | ● |  |  |
| 2512 | Bank overdraft | 2512 | ● | ● | ● | ● |  |  |
| 2513 | Leasing | 2513 | ● | ● | ● | ● |  |  |
| 2519 | Credit cards and other financing | 2519 | ● | ● | ● | ● |  |  |
| 2681 | Shareholder loans (suprimentos) | 268 › | ● | ● | ● | ● |  |  |

### Long-term debt (Balance sheet)

**Borrowings due after a year** (credit; role `long_term_debt`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2514 | Bank loans: due after a year | 2511 › | ● | ● | ● | ● |  | Own split of 251 so the balance sheet can show current and non-current. |

### Equity (Balance sheet)

**Capital** (credit; role `equity_capital`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 2631 | Partner drawings (advances on profits) *(contra)* | 263 | ● | ● | ● | ● |  | Money taken out by the owners; reduces equity. |
| 5110 | Share capital | 51 | ● | ● | ● | ● | ● |  |
| 5310 | Additional capital contributions | 53 | ● | ● | ● | ● |  |  |

**Reserves and retained earnings** (credit; role `retained_earnings`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 5510 | Legal reserve | 551 | ● | ● | ● | ● |  |  |
| 5590 | Other reserves | 559 | ● | ● | ● | ● |  |  |
| 5610 | Retained earnings | 56 | ● | ● | ● | ● | ● | The current year's result is calculated by the app and is not an account here. |

### Income (Profit & loss)

**Revenue** (credit; role `revenue`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 7110 | Sales of goods and materials | 711 | ● | ● | ● |  |  |  |
| 7120 | Sales of made-to-order joinery (kitchens, wardrobes, doors) | 712 |  | ● |  |  |  |  |
| 7190 | Discounts and returns allowed *(contra)* | 71 ⚑ | ● | ● | ● | ● | ● | Credit notes can post here. |
| 7211 | Construction works | 721 › | ● |  |  |  |  |  |
| 7212 | Labour and site supervision | 721 › | ● |  |  |  |  |  |
| 7213 | Design and project management | 721 › | ● |  |  |  |  |  |
| 7214 | Installation and fitting | 721 › |  | ● | ● |  |  |  |
| 7215 | Repairs and restoration | 721 › |  | ● |  |  |  |  |
| 7221 | Design and consultancy fees | 722 › |  |  | ● |  |  |  |
| 7222 | Styling and staging | 722 › |  |  | ● |  |  |  |
| 7231 | Management commissions | 723 › |  |  |  | ● |  |  |
| 7232 | Guest services (check-in, linen, concierge) | 723 › |  |  |  | ● |  |  |
| 7233 | Maintenance coordination fees | 723 › |  |  |  | ● |  |  |
| 7234 | Rental income from own properties | 723 › |  |  |  | ● |  |  |
| 7235 | Inspections and reports | 723 › |  |  |  | ● |  |  |
| 7241 | Account administration fees | 724 › |  |  |  |  | ● |  |

**Other income and gains** (credit; role `other_income`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 7510 | Operating grants | 75 | ● | ● | ● | ● |  |  |
| 7810 | Recharged costs and supplementary income | 781 | ● | ● | ● | ● |  |  |
| 7820 | Early-payment discounts received | 782 | ● | ● | ● | ● |  |  |
| 7830 | Recovered bad debts | 783 | ● | ● | ● | ● |  |  |
| 7881 | Insurance claims received | 788 › | ● | ● | ● | ● |  |  |
| 7885 | Gains on disposal of assets | 788 › | ● | ● | ● | ● |  |  |
| 7889 | Other income and gains | 788 | ● | ● | ● | ● | ● |  |

**Interest earned** (credit; role `interest_income`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 7910 | Interest earned | 791 | ● | ● | ● | ● | ● |  |

### Cost of sales (direct costs) (Profit & loss)

**Materials and goods** (debit; role `cost_materials`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6110 | Materials and goods used | 61 | ● | ● | ● |  |  |  |
| 6111 | Timber and boards | 61 › |  | ● |  |  |  |  |
| 6112 | Hardware and fittings | 61 › |  | ● |  |  |  |  |
| 6113 | Finishes (varnish, paint, glue) | 61 › |  | ● |  |  |  |  |
| 6121 | Furnishings and soft goods for resale | 61 › |  |  | ● |  |  |  |
| 6150 | Change in stock (year-end count) | 61 | ● | ● |  |  |  | Posted by Year-End Stock: the closing count on 31 Dec, reversed on 1 Jan. |
| 6190 | Purchase returns and discounts *(contra)* | 61 › | ● | ● | ● |  |  |  |

**Subcontractors and direct services** (debit; role `cost_direct_services`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6211 | Subcontractors (trades) | 621 | ● | ● | ● |  |  |  |
| 6212 | Specialist and design services | 6221 | ● | ● | ● |  |  |  |
| 6213 | Equipment and plant hire for jobs | 6261 | ● | ● |  |  |  |  |
| 6214 | Skip hire and waste removal | 6268 | ● |  |  |  |  |  |
| 6215 | Site consumables and small tools | 6231 | ● | ● |  |  |  |  |
| 6216 | Other direct job costs | 6268 | ● | ● | ● |  |  |  |
| 6217 | Cleaning and laundry for managed properties | 6267 |  |  |  | ● |  |  |
| 6218 | Pool and garden maintenance | 6226 |  |  |  | ● |  |  |
| 6219 | Repairs and maintenance of managed properties | 6226 |  |  |  | ● |  |  |
| 6220 | Booking-platform commissions | 6225 |  |  |  | ● |  |  |

**Direct labour** (debit; role `cost_direct_labour`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6321 | Wages: site and workshop staff | 632 › | ● | ● |  |  |  |  |
| 6351 | Employer social security: direct staff | 635 › | ● | ● |  |  |  |  |
| 6361 | Work-accident insurance: direct staff | 636 › | ● | ● |  |  |  |  |
| 6381 | Health and safety, training: direct staff | 638 › | ● | ● |  |  |  |  |

### Operating expenses (Profit & loss)

**Staff costs: office and management** (debit; role `opex_staff`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6311 | Management remuneration | 631 | ● | ● | ● | ● |  |  |
| 6322 | Wages: office staff | 632 › | ● | ● | ● | ● |  |  |
| 6352 | Employer social security: office staff | 635 › | ● | ● | ● | ● |  |  |
| 6353 | Employer social security: management | 635 › | ● | ● | ● | ● |  |  |
| 6362 | Work-accident insurance: office staff | 636 › | ● | ● | ● | ● |  |  |
| 6371 | Staff health insurance and welfare | 637 | ● | ● | ● | ● |  |  |
| 6382 | Training and other staff costs | 638 | ● | ● | ● | ● |  |  |

**Premises and utilities** (debit; role `opex_premises`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6226 | Repairs and maintenance of premises | 6226 | ● | ● | ● | ● |  |  |
| 6241 | Electricity | 6241 | ● | ● | ● | ● |  |  |
| 6243 | Water | 6243 | ● | ● | ● | ● |  |  |
| 6261 | Rent of premises | 6261 | ● | ● | ● | ● |  |  |
| 6262 | Telephone and internet | 6262 | ● | ● | ● | ● |  |  |
| 6267 | Cleaning and hygiene of premises | 6267 | ● | ● | ● | ● |  |  |

**Vehicles and travel** (debit; role `opex_vehicles`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6227 | Vehicle repairs, servicing and inspections | 6226 › | ● | ● | ● | ● |  |  |
| 6242 | Fuel | 6242 | ● | ● | ● | ● |  |  |
| 6251 | Travel and accommodation | 6251 | ● | ● | ● | ● |  |  |
| 6252 | Tolls and parking | 6252 ⚑ | ● | ● | ● | ● |  |  |
| 62631 | Insurance: vehicles | 6263 › | ● | ● | ● | ● |  |  |

**Professional and administrative** (debit; role `opex_admin`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6222 | Advertising and marketing | 6222 | ● | ● | ● | ● |  |  |
| 6224 | Accounting and professional fees | 6224 | ● | ● | ● | ● | ● |  |
| 6225 | Commissions paid to agents | 6225 | ● | ● | ● | ● |  |  |
| 6231 | Small tools and equipment (expensed) | 6231 | ● | ● | ● | ● |  |  |
| 6233 | Office supplies and printing | 6233 | ● | ● | ● | ● |  |  |
| 6234 | Gifts and samples | 6234 | ● | ● | ● | ● |  |  |
| 6265 | Legal and notary fees | 6265 | ● | ● | ● | ● |  |  |
| 6266 | Meals and entertainment | 6266 | ● | ● | ● | ● |  |  |
| 6268 | Other external services | 6268 | ● | ● | ● | ● | ● |  |
| 62632 | Insurance: business, liability and contract works | 6263 › | ● | ● | ● | ● |  |  |
| 62681 | Bank charges and commissions | 6268 ⚑ | ● | ● | ● | ● | ● |  |
| 62682 | Software, subscriptions and web services | 6268 › | ● | ● | ● | ● |  |  |

**Taxes and licences** (debit; role `opex_taxes`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6811 | Vehicle and property taxes (IUC, IMI) | 6811 | ● | ● | ● | ● |  |  |
| 6812 | Stamp duty and indirect taxes | 6812 | ● | ● | ● | ● |  |  |
| 6813 | Fees, licences and permits | 6813 | ● | ● | ● | ● |  |  |

**Depreciation** (debit; role `depreciation`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6422 | Depreciation: buildings and improvements | 6422 | ● | ● | ● |  |  |  |
| 6423 | Depreciation: plant and machinery | 6423 | ● | ● |  |  |  |  |
| 6424 | Depreciation: vehicles | 6424 | ● | ● | ● | ● |  |  |
| 6425 | Depreciation: office and IT equipment | 6425 | ● | ● | ● | ● |  |  |
| 6427 | Depreciation: other tangible assets | 6427 | ● | ● | ● | ● |  |  |
| 6441 | Amortisation: software and intangibles | 644 | ● | ● | ● | ● |  |  |

**Other expenses and losses** (debit; role `other_expense`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6830 | Bad debts written off | 683 | ● | ● | ● | ● |  |  |
| 6840 | Stock losses | 684 | ● | ● | ● |  |  |  |
| 6881 | Prior-period corrections | 6881 | ● | ● | ● | ● |  |  |
| 6882 | Donations | 6882 | ● | ● | ● | ● |  |  |
| 6883 | Memberships (associations) | 6883 | ● | ● | ● | ● |  |  |
| 6887 | Losses on disposal of assets | 688 › | ● | ● | ● | ● |  |  |
| 6888 | Other expenses and losses | 6888 | ● | ● | ● | ● | ● |  |

### Financing and tax (Profit & loss)

**Financing costs** (debit; role `interest_expense`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 6911 | Interest on bank loans | 691 | ● | ● | ● | ● |  |  |
| 6912 | Interest on overdraft, leasing and cards | 691 | ● | ● | ● | ● |  |  |
| 6981 | Loan arrangement fees and other financing costs | 698 | ● | ● | ● | ● |  |  |

**Income tax** (debit; role `income_tax`)

| No. | Name | SNC | C | W | I | P | K | Note |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 8121 | IRC: estimated tax for the year | 8121 | ● | ● | ● | ● |  |  |


## Accounts the app will use by role

| Role | Account | What the app does with it |
|---|---|---|
| `petty_cash` | 1110 | Default petty cash |
| `transfers_clearing` | 1290 | Both sides of a transfer between own accounts |
| `accounts_receivable` | 2110 | Debited by invoices, credited by payments received |
| `vat_input` | 2432 | VAT paid on purchases |
| `accounts_payable` | 2210 | Credited by purchase invoices, debited by payments made |
| `vat_output` | 2433 | VAT charged on sales |
| `vat_settlement` | 2436 | IVA paid to or refunded by the State |
| `withholding_payable` | 2421 | Tax withheld from pay, until paid to the State |
| `social_security_payable` | 2451 | Social security, until paid |
| `net_pay_payable` | 2311 | Net pay owed to staff, until paid |
| `holiday_accrual` | 2722 | Monthly build-up of holiday and Christmas pay |
| `client_money` | 2788 | Money held for owners (Property management, Client account) |
| `loan_principal` | 2511 | Loan repayments reduce this account (the Loan instalment split) |
| `share_capital` | 5110 | Where an opening balance for bank accounts is set against |
| `retained_earnings` | 5610 | Profit kept from earlier years |
| `default_sales` | 7120, 7211, 7221, 7231, 7241 | Default account on a new sales invoice (one per business) |
| `interest_income` | 7910 | Interest earned |
| `default_materials` | 6110 | Default account on a new purchase invoice |
| `stock_change` | 6150 |  |
| `wages_direct` | 6321 | Gross pay of site and workshop staff |
| `employer_social_security_direct` | 6351 | Employer social security on direct staff |
| `wages_office` | 6322 | Gross pay of office staff |
| `employer_social_security_office` | 6352 | Employer social security on office staff |
| `bank_charges` | 62681 | Bank fees (the Loan instalment split) |
| `interest_expense` | 6911 | Interest cover on the dashboard |
| `income_tax` | 8121 | Tax on profits |

## How payroll would post (the next change, once the chart is agreed)

One payroll entry per person per month, instead of single-account bank lines:

| | Debit | Credit |
|---|---|---|
| Gross pay | 6321 or 6322 | |
| Employer social security (about 23.75%) | 6351 or 6352 | |
| Net pay to the employee | | 2311 |
| Tax withheld (IRS) | | 2421 |
| Social security: employee share and employer share | | 2451 |
| Holiday and Christmas pay as duodecimos (a twelfth of each paid with the monthly salary) | 6321 or 6322, part of the gross | none needed |
| Paying the net pay | 2311 | bank |
| Paying the State | 2421, 2451 | bank |

## Questions for you and your accountant

1. ANSWERED (Tony, 2026-11-25): no SAF-T reporting; the app is for management use. The SNC numbering stays only as a tidy structure.
2. ANSWERED: autonomous taxation is handled by the external accountants, so there is no account for it (8123 removed).
3. ANSWERED: sub-account numbers as drafted.
4. ANSWERED: retentions yes (2119, 2212 stay in the Construction template); no work in progress (3610 removed).
5. ANSWERED: client money exists only in Casas Algarve and the Client Account company; Teia, Woodgrain and Algarve Interior do not use it (2788 stays in templates P and K only).
6. ANSWERED: stock for Teia and Woodgrain only (3210 stays in C and W, removed from I, P, K).
7. ANSWERED: monthly for some companies and quarterly for others (a setting per company); non-deductible VAT is left to the external accountants.
8. OPEN: Tony will check once the last changes are in and the sample data has run.

## What happens if you approve

1. I turn this data into the seed for each company and give subgroups and accounts their roles.
2. The app's code switches from hard-coded numbers to roles (the work I skipped over before).
3. Payroll entry and the VAT-on-direct-entries fix follow.
4. The sample data is rebuilt on the new chart.

Because you will start fresh, nothing has to be converted.
