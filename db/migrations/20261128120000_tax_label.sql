-- What the company calls the sales tax on screen: IVA (the Portuguese name) or VAT.
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'IVA' CHECK (tax_label IN ('IVA', 'VAT'));
