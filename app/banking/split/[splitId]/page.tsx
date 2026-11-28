import { notFound } from "next/navigation";
import { getSplitRows, listBankAccounts, listOpenSalesInvoiceOptions, listOpenPurchaseInvoiceOptions } from "@/lib/actions/banking-actions";
import { listAccountOptions } from "@/lib/actions/reference-actions";
import { listEmployeeOptions } from "@/lib/actions/employee-actions";
import { getClosedThroughYear } from "@/lib/year-close";
import { queryOne } from "@/lib/db";
import { splitInputFromRows } from "@/lib/banking-group";
import BankingEntryForm from "@/components/BankingEntryForm";

export const dynamic = "force-dynamic";

export default async function EditSplitPage({ params }: { params: Promise<{ splitId: string }> }) {
  const { splitId } = await params;
  const found = await getSplitRows(splitId);
  if (!found) notFound();
  const keepSales = found.rows.map((r) => r.sales_invoice_id);
  const keepPurchases = found.rows.map((r) => r.purchase_invoice_id);
  const [bankAccounts, accounts, salesInvoices, purchaseInvoices, closedThroughYear, employees, rateRow] = await Promise.all([
    listBankAccounts(undefined, true),
    listAccountOptions(),
    listOpenSalesInvoiceOptions(keepSales),
    listOpenPurchaseInvoiceOptions(keepPurchases),
    getClosedThroughYear(),
    listEmployeeOptions(),
    queryOne<{ vat_rate_1: string | null; vat_rate_2: string | null; vat_rate_3: string | null; vat_rate_4: string | null }>(
      "SELECT vat_rate_1, vat_rate_2, vat_rate_3, vat_rate_4 FROM app_settings WHERE id = 1"
    ),
  ]);
  const bank = bankAccounts.find((b) => b.id === found.bankAccountId);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit split transaction {bank ? `— ${bank.name}` : ""}</h1>
      <BankingEntryForm
        bankAccountId={found.bankAccountId}
        bankAccountKey={bank?.key}
        accounts={accounts}
        salesInvoices={salesInvoices}
        purchaseInvoices={purchaseInvoices}
        employees={employees}
        closedThroughYear={closedThroughYear}
        submitLabel="Save changes"
        split={{
          vatRates: [rateRow?.vat_rate_1, rateRow?.vat_rate_2, rateRow?.vat_rate_3, rateRow?.vat_rate_4].filter((v) => v != null).map(Number),
          presets: { loanPrincipal: null, interestExpense: null, bankCharges: null, withholding: null, socialSecurity: null },
        }}
        initialSplit={{ splitId, input: splitInputFromRows(found.bankAccountId, found.rows) }}
      />
    </div>
  );
}
