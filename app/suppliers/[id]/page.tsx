import { notFound } from "next/navigation";
import SupplierForm from "@/components/SupplierForm";
import { getSupplier } from "@/lib/actions/supplier-actions";
import { updateSupplierFormAction } from "@/lib/actions/supplier-form-actions";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await getSupplier(Number(id));
  if (!supplier) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit supplier</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <SupplierForm initial={supplier} action={updateSupplierFormAction.bind(null, supplier.id)} />
      </div>
    </div>
  );
}
