import { notFound } from "next/navigation";
import OpeningBalanceForm from "@/components/OpeningBalanceForm";
import { getOpeningBalance } from "@/lib/actions/opening-balance-actions";
import { updateOpeningBalanceFormAction } from "@/lib/actions/opening-balance-form-actions";
import { listAllAccountOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";

export default async function EditOpeningBalancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rowId = Number(id);
  const [row, accounts, closedThroughYear] = await Promise.all([getOpeningBalance(rowId), listAllAccountOptions(), getClosedThroughYear()]);
  if (!row) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit opening balance</h1>
      <OpeningBalanceForm
        accounts={accounts}
        initial={row}
        action={updateOpeningBalanceFormAction.bind(null, rowId)}
        submitLabel="Save"
        closedThroughYear={closedThroughYear}
      />
    </div>
  );
}
