import { notFound } from "next/navigation";
import ExpenseForm from "@/components/ExpenseForm";
import { updateExpenseFormAction } from "@/lib/actions/expense-form-actions";
import { getPurchaseInvoiceForEdit } from "@/lib/actions/expense-actions";
import { listSupplierOptions, listExpenseAccountOptions, listProjectOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  const invoice = await getPurchaseInvoiceForEdit(invoiceId);
  if (!invoice) notFound();
  // the accounts the invoice already uses stay in the list, even if they would not be offered on a new one
  const [suppliers, accounts, projects, closedThroughYear] = await Promise.all([
    listSupplierOptions(),
    listExpenseAccountOptions(invoice.lines.map((l) => l.account_no)),
    listProjectOptions(),
    getClosedThroughYear(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit invoice {invoice.invoice_number}</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <ExpenseForm
          suppliers={suppliers}
          accounts={accounts}
          projects={projects}
          initial={invoice}
          action={updateExpenseFormAction.bind(null, invoiceId)}
          closedThroughYear={closedThroughYear}
        />
      </div>
    </div>
  );
}
