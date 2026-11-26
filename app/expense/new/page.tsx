import ExpenseForm from "@/components/ExpenseForm";
import { createExpenseFormAction } from "@/lib/actions/expense-form-actions";
import { listSupplierOptions, listExpenseAccountOptions, listProjectOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";

export default async function NewExpensePage() {
  const [suppliers, accounts, projects, closedThroughYear] = await Promise.all([
    listSupplierOptions(),
    listExpenseAccountOptions(),
    listProjectOptions(),
    getClosedThroughYear(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">New invoice</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <ExpenseForm
          suppliers={suppliers}
          accounts={accounts}
          projects={projects}
          action={createExpenseFormAction}
          closedThroughYear={closedThroughYear}
        />
      </div>
    </div>
  );
}
