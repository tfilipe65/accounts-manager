-- A credit note can be applied to the sales invoice it corrects. It then counts as a payment on that
-- invoice (reducing what is still due) and is itself settled, so nothing is counted twice.
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS credit_for_invoice_id INTEGER REFERENCES sales_invoices(id) ON DELETE SET NULL;

-- Everything that settles a sales invoice: bank payments received, and credit notes applied to it.
-- A linked credit note appears twice, with opposite signs: as a payment on the invoice (+) and as
-- settled itself (-), so total money owed by clients is unchanged.
CREATE OR REPLACE VIEW sales_invoice_settlements AS
  SELECT sales_invoice_id, payment_date AS settled_on, in_amount + in_vat AS amount
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
