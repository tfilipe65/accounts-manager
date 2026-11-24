-- Several bank accounts, transfers, reconciliation, employees, login control, company details.

-- ---------------------------------------------------------------------------
-- Bank accounts: no longer limited to the four fixed keys (BANK1..BANK3, CASH).
-- A bank account is any row here; each one is tied to its own ledger account in the chart.
-- ---------------------------------------------------------------------------
ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_key_check;
ALTER TABLE bank_accounts
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN bank_name TEXT,
  ADD COLUMN iban TEXT,
  ADD COLUMN notes TEXT;

-- ---------------------------------------------------------------------------
-- Employees (master data, like clients and suppliers). Payroll payments are bank entries
-- that carry an employee_id.
-- ---------------------------------------------------------------------------
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT,
  vat_number TEXT,              -- NIF
  social_security_number TEXT,  -- NISS
  address TEXT,
  zip TEXT,
  city TEXT,
  country TEXT,
  telephone TEXT,
  email TEXT,
  iban TEXT,
  start_date DATE,
  end_date DATE,
  monthly_salary NUMERIC,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- employee_id: who a payment (salary, expenses refund, ...) was for.
-- transfer_id: the two legs of a transfer between our own accounts share one id, so reports can
--              leave them out of "money in / money out" and the pair is deleted together.
-- reconciled:  ticked once the line has been matched against the bank statement.
ALTER TABLE bank_transactions
  ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN transfer_id TEXT,
  ADD COLUMN reconciled BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX bank_transactions_transfer_idx ON bank_transactions (transfer_id) WHERE transfer_id IS NOT NULL;
CREATE INDEX bank_transactions_employee_idx ON bank_transactions (employee_id) WHERE employee_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Invoices: a supplier's invoice number only has to be unique for that supplier, and a
-- Commission document type (property management) joins the others.
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS purchase_invoices_invoice_number_key;
ALTER TABLE purchase_invoices ADD CONSTRAINT purchase_invoices_supplier_number_key UNIQUE (supplier_id, invoice_number);

ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_doc_type_check;
ALTER TABLE sales_invoices ADD CONSTRAINT sales_invoices_doc_type_check
  CHECK (doc_type IN ('Invoice', 'Credit Note', 'Proforma', 'Tax Refund', 'Interest', 'Commission', 'Other'));

-- ---------------------------------------------------------------------------
-- Login control: users can be switched off, lock after repeated wrong passwords, and
-- everything notable is written to an audit log.
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN last_login TIMESTAMPTZ,
  ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMPTZ,
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);

-- ---------------------------------------------------------------------------
-- Company details, what this business calls its clients/projects, and the account that holds
-- interest paid (used for interest cover on the dashboard).
-- ---------------------------------------------------------------------------
ALTER TABLE app_settings
  ADD COLUMN address TEXT,
  ADD COLUMN zip TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN country TEXT,
  ADD COLUMN client_label TEXT NOT NULL DEFAULT 'Clients',
  ADD COLUMN project_label TEXT NOT NULL DEFAULT 'Projects',
  ADD COLUMN account_no_interest_expense INTEGER REFERENCES accounts(account_no);

-- Stock is a current asset. (The chart had it under non-current assets, which broke the quick ratio.)
-- These two statements touch rows only on a database that already has the chart; on a new one
-- the seed (db/seed.sql) carries the corrected values.
UPDATE account_subgroups SET group_no = 4 WHERE subgroup_no = 90 AND group_no = 5;
UPDATE app_settings SET account_no_interest_expense = 3030
  WHERE EXISTS (SELECT 1 FROM accounts WHERE account_no = 3030) AND account_no_interest_expense IS NULL;
