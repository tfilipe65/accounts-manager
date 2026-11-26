-- How far the main current account may go below zero (the overdraft agreed with the bank). 0 = not allowed.
-- Every other bank account and the petty cash can never go below zero.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS overdraft_limit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (overdraft_limit >= 0);
