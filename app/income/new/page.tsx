import IncomeForm from "@/components/IncomeForm";
import { createIncomeFormAction } from "@/lib/actions/income-form-actions";
import { listCustomerOptions, listIncomeAccountOptions, listProjectOptions, listProductOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";

export default async function NewIncomePage() {
  const [customers, accounts, projects, products, closedThroughYear] = await Promise.all([
    listCustomerOptions(),
    listIncomeAccountOptions(),
    listProjectOptions(),
    listProductOptions(),
    getClosedThroughYear(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">New invoice</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <IncomeForm
          customers={customers}
          accounts={accounts}
          projects={projects}
          products={products}
          action={createIncomeFormAction}
          closedThroughYear={closedThroughYear}
        />
      </div>
    </div>
  );
}
