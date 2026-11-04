import { notFound } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { getProduct } from "@/lib/actions/product-actions";
import { updateProductFormAction } from "@/lib/actions/product-form-actions";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(Number(id));
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit product / service</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <ProductForm initial={product} action={updateProductFormAction.bind(null, product.id)} />
      </div>
    </div>
  );
}
