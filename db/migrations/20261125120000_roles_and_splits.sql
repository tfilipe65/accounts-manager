-- Roles: the app finds the accounts it needs (transfers, VAT, wages, ...) and the lines of the statements
-- (revenue, other expenses, income tax, cash, receivables, stock, ...) by role instead of by number, so the
-- chart of accounts can be numbered however suits the business.
--   account_subgroups.role   what a whole subgroup is (revenue, cash, receivables, income_tax, ...)
--   accounts.role            a single account the app uses by name (transfers_clearing, wages_direct, ...)
ALTER TABLE account_subgroups ADD COLUMN role TEXT;
ALTER TABLE accounts ADD COLUMN role TEXT;

-- Split transactions: several bank_transactions rows that share a split_id are ONE line on the bank statement
-- (one date, one bank account), divided between accounts, invoices or both. The ledger still sees each part.
ALTER TABLE bank_transactions ADD COLUMN split_id TEXT;
CREATE INDEX bank_transactions_split_idx ON bank_transactions (split_id) WHERE split_id IS NOT NULL;

-- A database built on the older chart keeps working: give its accounts the roles the app now looks for.
UPDATE account_subgroups SET role = 'revenue' WHERE subgroup_no = 200;
UPDATE account_subgroups SET role = 'other_income' WHERE subgroup_no = 210;
UPDATE account_subgroups SET role = 'other_expense' WHERE subgroup_no = 320;
UPDATE account_subgroups SET role = 'income_tax' WHERE subgroup_no = 340;
UPDATE account_subgroups SET role = 'cash' WHERE subgroup_no = 10;
UPDATE account_subgroups SET role = 'receivables' WHERE subgroup_no = 30;
UPDATE account_subgroups SET role = 'inventory' WHERE subgroup_no = 90;
UPDATE accounts SET role = 'transfers_clearing' WHERE account_no = 1170;
UPDATE accounts SET role = 'wages_direct' WHERE account_no = 2110;
UPDATE accounts SET role = 'wages_office' WHERE account_no = 2320;
UPDATE accounts SET role = 'withholding_payable' WHERE account_no = 3010;
UPDATE accounts SET role = 'share_capital' WHERE account_no = 1200;

-- Payroll: an employee's pay is either a direct cost (site, workshop) or an office/management cost, and a
-- payroll entry posts its journal lines together (entry_id), tagged with the employee.
ALTER TABLE employees ADD COLUMN cost_type TEXT NOT NULL DEFAULT 'office' CHECK (cost_type IN ('direct', 'office'));
ALTER TABLE journal_entries
  ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN entry_id TEXT;
CREATE INDEX journal_entries_entry_idx ON journal_entries (entry_id) WHERE entry_id IS NOT NULL;
