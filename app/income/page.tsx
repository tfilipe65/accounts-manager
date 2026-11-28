import { taxify } from "@/lib/tax-label";
import { getLabels } from "@/lib/labels";
import Link from "next/link";
import { listSalesInvoices } from "@/lib/actions/income-actions";
import { deleteIncomeAction } from "@/lib/actions/income-form-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";

export default async function IncomePage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const taxLabel = (await getLabels()).tax;
  const tx = (s: string) => taxify(s, taxLabel);
  const { all } = await searchParams;
  const showAll = all === "1";
  const year = await getEffectiveReportingYear();
  const invoices = await listSalesInvoices(showAll ? undefined : year);
  const totalOutstanding = invoices.reduce((s, i) => s + i.outstanding, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Income</h1>
          <Link href={showAll ? "/income" : "/income?all=1"} className="text-sm text-primary hover:underline">
            {showAll ? `Show ${year} only` : "Show all years"}
          </Link>
        </div>
        <Link href="/income/new" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
          + New invoice
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Invoice #</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2 text-right">Net</th>
              <th className="px-4 py-2 text-right">{tx("VAT")}</th>
              <th className="px-4 py-2 text-right">Gross</th>
              <th className="px-4 py-2 text-right">Paid</th>
              <th className="px-4 py-2 text-right">Outstanding</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-background">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/income/${inv.id}`} className="text-primary hover:underline">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{formatDate(inv.date)}</td>
                <td className="px-4 py-2">{inv.doc_type}</td>
                <td className="px-4 py-2">{inv.customer_name}</td>
                <td className="px-4 py-2 text-right">{fmt(inv.net)}</td>
                <td className="px-4 py-2 text-right">{fmt(inv.vat)}</td>
                <td className="px-4 py-2 text-right">{fmt(inv.gross)}</td>
                <td className="px-4 py-2 text-right">{fmt(inv.paid)}</td>
                <td className={`px-4 py-2 text-right ${inv.outstanding > 0.005 ? "font-semibold text-credit" : ""}`}>
                  {fmt(inv.outstanding)}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/income/${inv.id}`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                    <form action={deleteIncomeAction.bind(null, inv.id)}>
                      <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {invoices.length > 0 && (
            <tfoot>
              <tr className="border-t border-line bg-background font-semibold">
                <td className="px-4 py-2" colSpan={8}>
                  Total outstanding
                </td>
                <td className="px-4 py-2 text-right text-credit">{fmt(totalOutstanding)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
