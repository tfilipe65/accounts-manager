import Link from "next/link";
import { listEmployees } from "@/lib/actions/employee-actions";
import { deleteEmployeeAction } from "@/lib/actions/employee-form-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";

export default async function EmployeesPage() {
  const year = await getEffectiveReportingYear();
  const employees = await listEmployees(year);
  const paidYear = employees.reduce((s, e) => s + e.paid_year, 0);
  const active = employees.filter((e) => e.status === "Active").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Employees</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600">
            {active} active &middot; paid in {year}: <span className="font-semibold">{fmt(paidYear)}</span>
          </span>
          <Link href="/employees/new" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            + New employee
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Position</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Started</th>
              <th className="px-4 py-2 text-right">Monthly salary</th>
              <th className="px-4 py-2 text-right">Paid {year}</th>
              <th className="px-4 py-2 text-right">Paid, all years</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {employees.map((e) => (
              <tr key={e.id} className={`hover:bg-background ${e.status === "Inactive" ? "text-neutral-500" : ""}`}>
                <td className="px-4 py-2 font-medium">
                  <Link href={`/employees/${e.id}`} className="text-primary hover:underline">
                    {e.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{e.position}</td>
                <td className="px-4 py-2">{e.status}</td>
                <td className="px-4 py-2">{e.start_date ? formatDate(e.start_date) : ""}</td>
                <td className="px-4 py-2 text-right">{e.monthly_salary != null ? fmt(e.monthly_salary) : ""}</td>
                <td className="px-4 py-2 text-right">{fmt(e.paid_year)}</td>
                <td className="px-4 py-2 text-right">{fmt(e.paid_total)}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/employees/${e.id}`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                    <form action={deleteEmployeeAction.bind(null, e.id)}>
                      <button type="submit" className="text-xs text-neutral-500 hover:text-red-700" title="Deletes the employee, or sets them to Inactive if they have been paid">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
