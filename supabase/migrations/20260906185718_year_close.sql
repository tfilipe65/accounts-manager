-- Year-End Close: locks every year up to and including this one against new
-- writes to a dated financial record (journal entries, opening balances,
-- sales/purchase invoices, bank transactions). NULL = nothing closed yet.
-- Sequential-only by convention (enforced in lib/year-close.ts, not here):
-- you close the next year after this one, never an arbitrary year.
ALTER TABLE app_settings ADD COLUMN closed_through_year INTEGER;
