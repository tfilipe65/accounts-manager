import CustomerForm from "@/components/CustomerForm";
import { createCustomerFormAction } from "@/lib/actions/customer-form-actions";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">New customer</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <CustomerForm action={createCustomerFormAction} />
      </div>
    </div>
  );
}
