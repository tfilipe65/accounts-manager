import SupplierForm from "@/components/SupplierForm";
import { createSupplierFormAction } from "@/lib/actions/supplier-form-actions";

export default function NewSupplierPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">New supplier</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <SupplierForm action={createSupplierFormAction} />
      </div>
    </div>
  );
}
