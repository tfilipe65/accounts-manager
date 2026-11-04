import { notFound } from "next/navigation";
import {
  getBankTransaction,
  listBankAccounts,
  listOpenSalesInvoiceOptions,
  listOpenPurchaseInvoiceOptions,
} from "@/lib/actions/banking-actions";
import { updateBankTransactionFormAction } from "@/lib/actions/banking-form-actions";
import { listAccountOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";
import BankingEntryForm from "@/components/BankingEntryForm";

export default async function EditBankTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = Number(id);
  const [txn, bankAccounts, accounts, salesInvoices, purchaseInvoices, closedThroughYear] = await Promise.all([
    getBankTransaction(txId),
    listBankAccounts(),
    listAccountOptions(),
    listOpenSalesInvoiceOptions(),
    listOpenPurchaseInvoiceOptions(),
    getClosedThroughYear(),
  ]);
  if (!txn) notFound();
  const bankAccount = bankAccounts.find((b) => b.id === txn.bank_account_id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit transaction {bankAccount ? `— ${bankAccount.name}` : ""}</h1>
      <BankingEntryForm
        bankAccountId={txn.bank_account_id}
        accounts={accounts}
        salesInvoices={salesInvoices}
        purchaseInvoices={purchaseInvoices}
        initial={txn}
        submitLabel="Save"
        action={updateBankTransactionFormAction.bind(null, txId, bankAccount?.key ?? "BANK1")}
        closedThroughYear={closedThroughYear}
      />
    </div>
  );
}
