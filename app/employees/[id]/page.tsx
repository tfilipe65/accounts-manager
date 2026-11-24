import { notFound } from "next/navigation";
import EmployeeForm from "@/components/EmployeeForm";
import { getEmployee, listEmployeePayments } from "@/lib/actions/employee-actions";
import { updateEmployeeFormAction } from "@/lib/actions/employee-form-actions";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployee(Number(id));
  if (!employee) notFound();
  const payments = await listEmployeePayments(employee.id);
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">{employee.name}</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <EmployeeForm initial={employee} action={updateEmployeeFormAction.bind(null, employee.id)} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-primary">Payments</h2>
          <span className="text-sm text-neutral-600">
            {payments.length} payments &middot; total <span className="font-semibold">{fmt(total)}</span>
          </span>
        </div>
        <p className="text-sm text-neutral-600">
          Taken from the bank register: any bank entry on a ledger account (for example Payroll) that names this employee.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Paid from</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-background">
                  <td className="px-4 py-2">{formatDate(p.payment_date)}</td>
                  <td className="px-4 py-2">{p.description}</td>
                  <td className="px-4 py-2">{p.bank_account}</td>
                  <td className="px-4 py-2 text-neutral-600">{p.account}</td>
                  <td className="px-4 py-2 text-right">{fmt(p.amount)}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-neutral-500">
                    No payments yet. Choose this employee on a bank entry to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
