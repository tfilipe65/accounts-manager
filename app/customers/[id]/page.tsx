import { notFound } from "next/navigation";
import CustomerForm from "@/components/CustomerForm";
import { getCustomer } from "@/lib/actions/customer-actions";
import { updateCustomerFormAction } from "@/lib/actions/customer-form-actions";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(Number(id));
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit customer</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <CustomerForm initial={customer} action={updateCustomerFormAction.bind(null, customer.id)} />
      </div>
    </div>
  );
}
