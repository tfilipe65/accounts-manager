import { notFound } from "next/navigation";
import IncomeForm from "@/components/IncomeForm";
import { updateIncomeFormAction } from "@/lib/actions/income-form-actions";
import { getSalesInvoiceForEdit, listInvoicesForCredit } from "@/lib/actions/income-actions";
import { listCustomerOptions, listIncomeAccountOptions, listProjectOptions, listProductOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";

export default async function EditIncomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  const invoice = await getSalesInvoiceForEdit(invoiceId);
  if (!invoice) notFound();
  // the accounts the invoice already uses stay in the list, even if they would not be offered on a new one
  const [customers, accounts, projects, products, closedThroughYear, creditTargets] = await Promise.all([
    listCustomerOptions(),
    listIncomeAccountOptions(invoice.lines.map((l) => l.account_no)),
    listProjectOptions(),
    listProductOptions(),
    getClosedThroughYear(),
    listInvoicesForCredit(invoice.credit_for_invoice_id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit invoice {invoice.invoice_number}</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <IncomeForm
          customers={customers}
          accounts={accounts}
          projects={projects}
          products={products}
          initial={invoice}
          action={updateIncomeFormAction.bind(null, invoiceId)}
          closedThroughYear={closedThroughYear}
          creditTargets={creditTargets}
        />
      </div>
    </div>
  );
}
