import Link from "next/link";
import { query } from "@/lib/db";
import { deleteSupplierAction } from "@/lib/actions/supplier-form-actions";

type Supplier = {
  id: number;
  name: string;
  city: string | null;
  contact: string | null;
  telephone: string | null;
  email: string | null;
  vat_number: string | null;
};

export default async function SuppliersPage() {
  const suppliers = await query<Supplier>(
    "SELECT id, name, city, contact, telephone, email, vat_number FROM suppliers ORDER BY name"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Suppliers</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600">{suppliers.length} suppliers</span>
          <Link href="/suppliers/new" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            + New supplier
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Telephone</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">VAT Number</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-background">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/suppliers/${s.id}`} className="text-primary hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{s.city}</td>
                <td className="px-4 py-2">{s.contact}</td>
                <td className="px-4 py-2">{s.telephone}</td>
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2">{s.vat_number}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/suppliers/${s.id}`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                    <form action={deleteSupplierAction.bind(null, s.id)}>
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
