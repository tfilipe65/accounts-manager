import AccountForm from "@/components/AccountForm";
import { createAccountFormAction } from "@/lib/actions/account-form-actions";
import { listSubgroupOptions } from "@/lib/actions/account-actions";

export default async function NewAccountPage() {
  const subgroups = await listSubgroupOptions();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">New account</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <AccountForm subgroups={subgroups} action={createAccountFormAction} />
      </div>
    </div>
  );
}
