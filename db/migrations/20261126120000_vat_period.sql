-- How often the company files its VAT return: shown on the VAT report.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS vat_return_period TEXT NOT NULL DEFAULT 'quarterly'
  CHECK (vat_return_period IN ('monthly', 'quarterly'));
