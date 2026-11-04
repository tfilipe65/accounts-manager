import { getTopCustomers, getTopSuppliers, getTopProducts, type Top10Row } from "@/lib/actions/top10-actions";
import { formatMoney as fmt } from "@/lib/formatters";

function Top10Table({ title, rows }: { title: string; rows: Top10Row[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={r.name} className="hover:bg-background">
                <td className="w-8 px-4 py-2 text-neutral-400">{i + 1}</td>
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2 text-right">{fmt(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-center text-neutral-500" colSpan={3}>
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function Top10Page() {
  const [customers, suppliers, products] = await Promise.all([getTopCustomers(), getTopSuppliers(), getTopProducts()]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-primary">Top 10s</h1>
      <Top10Table title="Top 10 Customers (by sales)" rows={customers} />
      <Top10Table title="Top 10 Suppliers (by spend)" rows={suppliers} />
      <Top10Table title="Top 10 Products/Services (by sales)" rows={products} />
    </div>
  );
}
