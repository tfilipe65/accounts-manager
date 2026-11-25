"use client";

// "New account" and "Edit" on the Chart of Accounts open the form in a floating window instead of a separate page.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import AccountForm from "@/components/AccountForm";
import { saveAccountAction } from "@/lib/actions/account-form-actions";
import type { Account, SubgroupOption } from "@/lib/actions/account-actions";

export default function AccountDialogButton({
  subgroups,
  account,
  label,
  className,
}: {
  subgroups: SubgroupOption[];
  account?: Account;
  label: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && (
        <Modal title={account ? `Edit account ${account.account_no}` : "New account"} onClose={close}>
          <AccountForm subgroups={subgroups} initial={account} action={saveAccountAction.bind(null, account?.account_no ?? null)} onSaved={saved} autoFocus />
        </Modal>
      )}
    </>
  );
}
