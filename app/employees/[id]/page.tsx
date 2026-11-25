import { notFound } from "next/navigation";
import EmployeeForm from "@/components/EmployeeForm";
import { getEmployee, listEmployeePayments } from "@/lib/actions/employee-actions";
import { updateEmployeeFormAction } from "@/lib/actions/employee-form-actions";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";
import PayrollForm from "@/components/PayrollForm";
import { listPayrollRuns } from "@/lib/actions/payroll-actions";
import { deletePayrollRunAction } from "@/lib/actions/payroll-form-actions";
import { listBankAccounts } from "@/lib/actions/banking-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployee(Number(id));
  if (!employee) notFound();
  const [payments, runs, banks, year, closedThroughYear] = await Promise.all([
    listEmployeePayments(employee.id),
    listPayrollRuns(employee.id),
    listBankAccounts(),
    getEffectiveReportingYear(),
    getClosedThroughYear(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const payDate = Number(today.slice(0, 4)) === year ? today : `${year}-12-31`;
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">{employee.name}</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <EmployeeForm initial={employee} action={updateEmployeeFormAction.bind(null, employee.id)} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary">Payroll</h2>
        <PayrollForm
          employeeId={employee.id}
          defaultGross={employee.monthly_salary}
          defaultDate={payDate}
          banks={banks.map((b) => ({ id: b.id, name: b.name }))}
          closedThroughYear={closedThroughYear}
        />
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Gross</th>
                <th className="px-4 py-2 text-right">Employer social sec.</th>
                <th className="px-4 py-2 text-right">IRS withheld</th>
                <th className="px-4 py-2 text-right">Social security owed</th>
                <th className="px-4 py-2 text-right">Net pay</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((r) => (
                <tr key={r.entry_id} className="hover:bg-background">
                  <td className="px-4 py-2">{formatDate(r.date)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.gross)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.employer_ss)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.irs)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.social_security)}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(r.net)}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deletePayrollRunAction.bind(null, r.entry_id)}>
                      <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-neutral-500">
                    No payroll posted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
