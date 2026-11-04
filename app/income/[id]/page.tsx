import { notFound } from "next/navigation";
import IncomeForm from "@/components/IncomeForm";
import { updateIncomeFormAction } from "@/lib/actions/income-form-actions";
import { getSalesInvoiceForEdit } from "@/lib/actions/income-actions";
import { listCustomerOptions, listAccountOptions, listProjectOptions, listProductOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";

export default async function EditIncomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  const [invoice, customers, accounts, projects, products, closedThroughYear] = await Promise.all([
    getSalesInvoiceForEdit(invoiceId),
    listCustomerOptions(),
    listAccountOptions(),
    listProjectOptions(),
    listProductOptions(),
    getClosedThroughYear(),
  ]);
  if (!invoice) notFound();

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
        />
      </div>
    </div>
  );
}
