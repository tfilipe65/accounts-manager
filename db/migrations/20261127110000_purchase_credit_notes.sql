-- Supplier credit notes: a purchase document can be marked as a credit note and applied to the invoice it
-- corrects (counts as a payment on that invoice). A refund from the supplier is a bank entry linked to the
-- credit note, so money in and money out both count when working out what is still due.
ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'Invoice' CHECK (doc_type IN ('Invoice', 'Credit Note')),
  ADD COLUMN IF NOT EXISTS credit_for_invoice_id INTEGER REFERENCES purchase_invoices(id) ON DELETE SET NULL;

CREATE OR REPLACE VIEW sales_invoice_settlements AS
  SELECT sales_invoice_id, payment_date AS settled_on, in_amount + in_vat - out_amount - out_vat AS amount
  FROM bank_transactions WHERE sales_invoice_id IS NOT NULL
  UNION ALL
  SELECT cn.credit_for_invoice_id, cn.date, -SUM(l.quantity * l.price_ex_vat * (1 - l.discount_perc) * (1 + l.vat_perc))
  FROM sales_invoices cn JOIN sales_invoice_lines l ON l.sales_invoice_id = cn.id
  WHERE cn.credit_for_invoice_id IS NOT NULL AND cn.doc_type = 'Credit Note'
  GROUP BY cn.id, cn.credit_for_invoice_id, cn.date
  UNION ALL
  SELECT cn.id, cn.date, SUM(l.quantity * l.price_ex_vat * (1 - l.discount_perc) * (1 + l.vat_perc))
  FROM sales_invoices cn JOIN sales_invoice_lines l ON l.sales_invoice_id = cn.id
  WHERE cn.credit_for_invoice_id IS NOT NULL AND cn.doc_type = 'Credit Note'
  GROUP BY cn.id, cn.date;

CREATE OR REPLACE VIEW purchase_invoice_settlements AS
  SELECT purchase_invoice_id, payment_date AS settled_on, out_amount + out_vat - in_amount - in_vat AS amount
  FROM bank_transactions WHERE purchase_invoice_id IS NOT NULL
  UNION ALL
  SELECT cn.credit_for_invoice_id, cn.date, -SUM(l.amount_inc_vat)
  FROM purchase_invoices cn JOIN purchase_invoice_lines l ON l.purchase_invoice_id = cn.id
  WHERE cn.credit_for_invoice_id IS NOT NULL AND cn.doc_type = 'Credit Note'
  GROUP BY cn.id, cn.credit_for_invoice_id, cn.date
  UNION ALL
  SELECT cn.id, cn.date, SUM(l.amount_inc_vat)
  FROM purchase_invoices cn JOIN purchase_invoice_lines l ON l.purchase_invoice_id = cn.id
  WHERE cn.credit_for_invoice_id IS NOT NULL AND cn.doc_type = 'Credit Note'
  GROUP BY cn.id, cn.date;
