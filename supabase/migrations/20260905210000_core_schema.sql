-- Core schema for Accounts Manager, replicating Teia_Accounts.xlsb (Teia Firme
-- Lda's bookkeeping workbook) for the sections in scope for Phase 1: chart of
-- accounts, master data (customers/suppliers/products/projects), the four
-- transaction registers (sales/purchase invoices, bank+cash, journal
-- entries), and opening balances.
--
-- Deliberately NOT modelled as tables: Trial_Balance, P&L, Tax_Report,
-- IVA_Summary, Dashboard, Summary, Ageing, Top10s, Project_Report,
-- Interactive_Reports, Income_Monitor, Expense_Monitor. In the workbook these
-- are all live formulas/SUMIFS over the registers below (confirmed against
-- the workbook's own formulas, e.g. Income!AH = SUMIF over the bank/cash
-- sales-invoice columns) -- so here they are SQL views/queries computed from
-- this schema, not separate storage. Recomputing a report is a query, not a
-- migration.
--
-- Applied via the Supabase MCP apply_migration tool; kept here too so schema
-- history lives in the repo, same convention as the sibling apps.

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-row company/config settings -- successor to the workbook's Settings
-- sheet (Business/Year/Other settings blocks, VAT rates, reserved account
-- numbers). Reserved account numbers are FKs into accounts once the chart of
-- accounts is loaded (nullable so this row can be created before accounts
-- are seeded).
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Teia Firme Lda',
  vat_number TEXT,
  bank_name TEXT,
  iban TEXT,
  bic TEXT,
  telephone TEXT,
  email TEXT,
  website TEXT,
  currency TEXT NOT NULL DEFAULT '€',
  date_format TEXT NOT NULL DEFAULT 'dd-mmm-yyyy',
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  reporting_year INTEGER NOT NULL,
  first_invoice_number INTEGER NOT NULL DEFAULT 1,
  invoice_prefix TEXT,
  invoice_suffix TEXT,
  payment_term_days INTEGER NOT NULL DEFAULT 14,
  payment_term_reminder_days INTEGER NOT NULL DEFAULT 7,
  validity_period_offer_days INTEGER NOT NULL DEFAULT 60,
  interest_perc NUMERIC,
  const_guarantee_years INTEGER,
  vat_rate_1 NUMERIC NOT NULL DEFAULT 0.23,
  vat_rate_2 NUMERIC NOT NULL DEFAULT 0.13,
  vat_rate_3 NUMERIC NOT NULL DEFAULT 0.06,
  vat_rate_4 NUMERIC,
  age_analysis_1_days INTEGER NOT NULL DEFAULT 30,
  age_analysis_2_days INTEGER NOT NULL DEFAULT 60,
  age_analysis_3_days INTEGER NOT NULL DEFAULT 90
);

-- ---------------------------------------------------------------------------
-- Chart of accounts (3-level hierarchy: group -> subgroup -> account).
-- Ported from Chart_Accounts!C261:I268 (groups), C211:K239 (subgroups),
-- C8:H204 (accounts). normal_balance mirrors the sheet's +/- column: '+'
-- (debit-normal: cost of sales, expenses, assets) vs '-' (credit-normal:
-- income, liabilities, equity) -- standard accounting convention.
-- ---------------------------------------------------------------------------

CREATE TABLE account_groups (
  group_no INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  statement TEXT NOT NULL CHECK (statement IN ('P&L', 'Balance Sheet'))
);

CREATE TABLE account_subgroups (
  subgroup_no INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  group_no INTEGER NOT NULL REFERENCES account_groups(group_no),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit'))
);

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  account_no INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subgroup_no INTEGER NOT NULL REFERENCES account_subgroups(subgroup_no),
  is_reserved BOOLEAN NOT NULL DEFAULT false, -- AR/AP/bank/cash/sales-tax accounts app_settings points at; guarded against deletion
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings
  ADD COLUMN account_no_ar INTEGER REFERENCES accounts(account_no),
  ADD COLUMN account_no_ap INTEGER REFERENCES accounts(account_no),
  ADD COLUMN account_no_sales INTEGER REFERENCES accounts(account_no),
  ADD COLUMN account_no_sales_tax_payable INTEGER REFERENCES accounts(account_no),
  ADD COLUMN account_no_purchase_tax_payable INTEGER REFERENCES accounts(account_no),
  ADD COLUMN account_no_vat_paid_received INTEGER REFERENCES accounts(account_no);

-- ---------------------------------------------------------------------------
-- Master data. Customers/Suppliers/Products are keyed by NAME in the
-- workbook (every VLOOKUP/SUMIF against them matches on the name column, not
-- a numeric id -- confirmed via LIST_INCOME_CUSTOMER, LIST_EXPENSE_SUPPLIER,
-- LIST_INCOME_PRODUCT_SERVICE), so name stays the unique business key here
-- too even though a surrogate id is the FK everywhere else.
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  zip TEXT,
  city TEXT,
  country TEXT,
  contact TEXT,
  payment_term_days INTEGER,
  telephone TEXT,
  email TEXT,
  vat_number TEXT, -- Portuguese NIF
  coc_number TEXT,
  intra_community TEXT CHECK (intra_community IN ('EU', 'NON-EU') OR intra_community IS NULL),
  free_code_1 TEXT,
  free_code_2 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  zip TEXT,
  city TEXT,
  country TEXT,
  contact TEXT,
  payment_term_days INTEGER,
  telephone TEXT,
  email TEXT,
  vat_number TEXT,
  coc_number TEXT,
  intra_community TEXT CHECK (intra_community IN ('EU', 'NON-EU') OR intra_community IS NULL),
  free_code_1 TEXT,
  free_code_2 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products_services (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  unit TEXT,
  price_ex_vat NUMERIC,
  vat_perc NUMERIC,
  free_code_1 TEXT,
  free_code_2 TEXT,
  free_code_3 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- short code (e.g. "Alfa", "Sandy") -- what invoices/expenses actually reference
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT, -- In Progress / Job Delaid / On Hold / Restarted / Completed / Def. Liability / Guarantee Period
  free_code_1 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Cash/bank registers, unified (Accounts Manager.xlsb's better-engineered
-- design: one BANK sheet with an account selector, vs. Teia_Accounts.xlsb's
-- 3 hardcoded Bank_1/2/3 sheets + a separate Cash sheet). Rows seeded once
-- from app_settings' reserved Bank1/Bank2/Bank3/Cash account numbers.
-- ---------------------------------------------------------------------------

CREATE TABLE bank_accounts (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL CHECK (key IN ('BANK1', 'BANK2', 'BANK3', 'CASH')),
  name TEXT NOT NULL, -- e.g. "BCP - Check Acct.", "Cash Account"
  account_no INTEGER UNIQUE NOT NULL REFERENCES accounts(account_no),
  is_cash BOOLEAN NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- Sales invoices (Income sheet). Header = one row per invoice number; lines
-- carry the per-line product/qty/price/VAT/account/project. Paid/outstanding
-- are NOT stored -- in the workbook they're SUMIFs over the bank/cash
-- registers matched by invoice number (Income!AH), so here they're computed
-- from bank_transactions.sales_invoice_id at query time.
-- ---------------------------------------------------------------------------

CREATE TABLE sales_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'Invoice' CHECK (doc_type IN ('Invoice', 'Credit Note', 'Proforma', 'Tax Refund', 'Interest', 'Other')),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  reference TEXT,
  sales_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sales_invoice_lines (
  id SERIAL PRIMARY KEY,
  sales_invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  product_service_id INTEGER REFERENCES products_services(id),
  subject TEXT, -- line description (workbook's "Subject" column)
  quantity NUMERIC NOT NULL DEFAULT 1,
  price_ex_vat NUMERIC NOT NULL DEFAULT 0,
  vat_perc NUMERIC NOT NULL DEFAULT 0,
  discount_perc NUMERIC NOT NULL DEFAULT 0,
  account_no INTEGER NOT NULL REFERENCES accounts(account_no),
  project_id INTEGER REFERENCES projects(id),
  free_code TEXT,
  UNIQUE (sales_invoice_id, line_no)
);

-- ---------------------------------------------------------------------------
-- Purchase invoices (Expense sheet). Simpler than Income -- no per-line
-- product/qty breakdown in the workbook, just a direct gross amount per line
-- (Amount Inc. IVA), with IVA and Amount exc. IVA derived from it and the
-- line's own VAT%.
-- ---------------------------------------------------------------------------

CREATE TABLE purchase_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL, -- the supplier's own invoice number
  date DATE NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_invoice_lines (
  id SERIAL PRIMARY KEY,
  purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  description TEXT,
  account_no INTEGER NOT NULL REFERENCES accounts(account_no),
  project_id INTEGER REFERENCES projects(id),
  vat_perc NUMERIC NOT NULL DEFAULT 0,
  amount_inc_vat NUMERIC NOT NULL DEFAULT 0, -- entered directly, matches the workbook's own input column
  remarks TEXT,
  free_code_1 TEXT,
  free_code_2 TEXT,
  UNIQUE (purchase_invoice_id, line_no)
);

-- ---------------------------------------------------------------------------
-- Bank/cash transactions. Each row is either a payment against a sales or
-- purchase invoice (sales_invoice_id / purchase_invoice_id set, matching the
-- workbook's Sales Invoice# / Purchase Invoice# columns) or a direct entry
-- against an account_no (bank charges, transfers, etc.) -- never more than
-- one of those three. Cash-only fields (quantity/product_service/price) cover
-- the workbook's petty-cash retail-sale rows (Cash!I,K,N).
-- ---------------------------------------------------------------------------

CREATE TABLE bank_transactions (
  id SERIAL PRIMARY KEY,
  bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
  payment_date DATE NOT NULL,
  description TEXT,
  sales_invoice_id INTEGER REFERENCES sales_invoices(id),
  purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
  account_no INTEGER REFERENCES accounts(account_no),
  vat_perc NUMERIC,
  in_amount NUMERIC NOT NULL DEFAULT 0,
  in_vat NUMERIC NOT NULL DEFAULT 0,
  out_amount NUMERIC NOT NULL DEFAULT 0,
  out_vat NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC, -- petty-cash retail sales only
  product_service_id INTEGER REFERENCES products_services(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bank_transactions_one_link CHECK (
    (CASE WHEN sales_invoice_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN purchase_invoice_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN account_no IS NOT NULL THEN 1 ELSE 0 END) <= 1
  )
);
CREATE INDEX bank_transactions_sales_invoice_idx ON bank_transactions (sales_invoice_id) WHERE sales_invoice_id IS NOT NULL;
CREATE INDEX bank_transactions_purchase_invoice_idx ON bank_transactions (purchase_invoice_id) WHERE purchase_invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Journal entries (manual double-entry) and opening balances.
-- ---------------------------------------------------------------------------

CREATE TABLE journal_entries (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  account_no INTEGER NOT NULL REFERENCES accounts(account_no),
  description TEXT,
  vat_perc NUMERIC,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE opening_balances (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  account_no INTEGER NOT NULL REFERENCES accounts(account_no),
  description TEXT,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
