import { getProjectReport } from "@/lib/actions/project-report-actions";
import { formatMoney as fmt } from "@/lib/formatters";

export default async function ProjectReportPage() {
  const rows = await getProjectReport();
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalExpenditure = rows.reduce((s, r) => s + r.expenditure, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Project Report</h1>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Revenue</th>
              <th className="px-4 py-2 text-right">Expenditure</th>
              <th className="px-4 py-2 text-right">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-background">
                <td className="px-4 py-2 font-medium">{r.code}</td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-neutral-600">{r.status}</td>
                <td className="px-4 py-2 text-right">{fmt(r.revenue)}</td>
                <td className="px-4 py-2 text-right">{fmt(r.expenditure)}</td>
                <td className={`px-4 py-2 text-right font-medium ${r.result < 0 ? "text-credit" : "text-debit"}`}>{fmt(r.result)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary font-semibold">
              <td className="px-4 py-2" colSpan={3}>
                Total
              </td>
              <td className="px-4 py-2 text-right">{fmt(totalRevenue)}</td>
              <td className="px-4 py-2 text-right">{fmt(totalExpenditure)}</td>
              <td className="px-4 py-2 text-right">{fmt(totalRevenue - totalExpenditure)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
