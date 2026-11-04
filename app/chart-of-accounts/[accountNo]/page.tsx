import { notFound } from "next/navigation";
import AccountForm from "@/components/AccountForm";
import { getAccount, listSubgroupOptions } from "@/lib/actions/account-actions";
import { updateAccountFormAction } from "@/lib/actions/account-form-actions";

export default async function EditAccountPage({ params }: { params: Promise<{ accountNo: string }> }) {
  const { accountNo } = await params;
  const accountNoNum = Number(accountNo);
  const [account, subgroups] = await Promise.all([getAccount(accountNoNum), listSubgroupOptions()]);
  if (!account) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit account</h1>
      <div className="rounded-lg border border-line bg-surface p-6">
        <AccountForm subgroups={subgroups} initial={account} action={updateAccountFormAction.bind(null, accountNoNum)} />
      </div>
    </div>
  );
}
