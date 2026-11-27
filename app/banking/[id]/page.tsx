import { notFound } from "next/navigation";
import {
  getBankTransaction,
  listBankAccounts,
  listOpenSalesInvoiceOptions,
  listOpenPurchaseInvoiceOptions,
} from "@/lib/actions/banking-actions";
import { updateBankTransactionFormAction } from "@/lib/actions/banking-form-actions";
import { listAccountOptions } from "@/lib/actions/reference-actions";
import { listEmployeeOptions } from "@/lib/actions/employee-actions";
import { getClosedThroughYear } from "@/lib/year-close";
import BankingEntryForm from "@/components/BankingEntryForm";

export default async function EditBankTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = Number(id);
  const [txn, bankAccounts, accounts, salesInvoices, purchaseInvoices, closedThroughYear, employees] = await Promise.all([
    getBankTransaction(txId),
    listBankAccounts(undefined, true),
    listAccountOptions(),
    getBankTransaction(txId).then((t) => listOpenSalesInvoiceOptions(t?.sales_invoice_id)),
    getBankTransaction(txId).then((t) => listOpenPurchaseInvoiceOptions(t?.purchase_invoice_id)),
    getClosedThroughYear(),
    listEmployeeOptions(),
  ]);
  if (!txn) notFound();
  const bankAccount = bankAccounts.find((b) => b.id === txn.bank_account_id);
  if (txn.transfer_id) {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="text-2xl font-semibold text-primary">Transfer between accounts</h1>
        <p className="text-sm text-neutral-600">
          This line is one side of a transfer, so it can&apos;t be edited on its own. Delete the transfer on the Banks &amp; Cash page (both sides go
          together) and enter it again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit transaction {bankAccount ? `— ${bankAccount.name}` : ""}</h1>
      <BankingEntryForm
        bankAccountId={txn.bank_account_id}
        accounts={accounts}
        salesInvoices={salesInvoices}
        purchaseInvoices={purchaseInvoices}
        employees={employees}
        initial={txn}
        submitLabel="Save"
        action={updateBankTransactionFormAction.bind(null, txId, bankAccount?.key ?? "")}
        closedThroughYear={closedThroughYear}
      />
    </div>
  );
}
