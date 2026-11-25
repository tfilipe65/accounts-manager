"use client";

import { useActionState, useEffect } from "react";
import type { Account, SubgroupOption } from "@/lib/actions/account-actions";

type FormState = { error?: string; success?: boolean } | undefined;

export default function AccountForm({
  subgroups,
  action,
  initial,
  onSaved,
  autoFocus,
}: {
  subgroups: SubgroupOption[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Account;
  /** Called once the account has been saved (a floating window closes itself here). */
  onSaved?: () => void;
  autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) onSaved?.();
  }, [state, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Account #">
          <input type="number" name="account_no" defaultValue={initial?.account_no} required autoFocus={autoFocus && !initial} className="input" />
        </Field>
        <Field label="Name" className="md:col-span-2">
          <input name="name" defaultValue={initial?.name} required autoFocus={autoFocus && !!initial} className="input" />
        </Field>
        <Field label="Subgroup" className="md:col-span-3">
          <select name="subgroup_no" defaultValue={initial?.subgroup_no ?? ""} required className="input">
            <option value="" disabled>
              Select subgroup
            </option>
            {subgroups.map((s) => (
              <option key={s.subgroup_no} value={s.subgroup_no}>
                {s.group_name} &rsaquo; {s.subgroup_no} {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {initial?.is_reserved && (
        <p className="text-xs text-neutral-500">
          This is a reserved system account (used by Settings as the Accounts Receivable/Payable, a bank account, or Cash). Change
          which account is reserved from Settings, not here.
        </p>
      )}

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save account"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
