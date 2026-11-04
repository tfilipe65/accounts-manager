import Link from "next/link";
import { query } from "@/lib/db";
import { deleteProductAction } from "@/lib/actions/product-form-actions";

type Product = {
  id: number;
  name: string;
  unit: string | null;
  price_ex_vat: number | null;
  vat_perc: number | null;
};

export default async function ProductsServicesPage() {
  const products = await query<Product>("SELECT id, name, unit, price_ex_vat, vat_perc FROM products_services ORDER BY name");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Products &amp; Services</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600">{products.length} items</span>
          <Link href="/products-services/new" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            + New
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Price ex. VAT</th>
              <th className="px-4 py-2">VAT %</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-background">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/products-services/${p.id}`} className="text-primary hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{p.unit}</td>
                <td className="px-4 py-2">{p.price_ex_vat}</td>
                <td className="px-4 py-2">{p.vat_perc != null ? `${(p.vat_perc * 100).toFixed(0)}%` : ""}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/products-services/${p.id}`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                    <form action={deleteProductAction.bind(null, p.id)}>
                      <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
