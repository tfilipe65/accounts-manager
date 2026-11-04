import ProductForm from "@/components/ProductForm";
import { createProductFormAction } from "@/lib/actions/product-form-actions";

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">New product / service</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <ProductForm action={createProductFormAction} />
      </div>
    </div>
  );
}
