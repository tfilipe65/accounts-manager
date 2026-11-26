"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { AccountOption } from "@/lib/actions/reference-actions";
import type { OpeningBalanceInput } from "@/lib/actions/opening-balance-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import AccountSelect from "@/components/AccountSelect";
import DebitCreditHelp from "@/components/DebitCreditHelp";

type FormState = { error?: string; success?: boolean } | undefined;

export default function OpeningBalanceForm({
  accounts,
  action,
  initial,
  submitLabel = "Add",
  closedThroughYear,
}: {
  accounts: AccountOption[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: OpeningBalanceInput;
  submitLabel?: string;
  closedThroughYear: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [accountNo, setAccountNo] = useState<number | "">(initial?.account_no ?? "");

  useEffect(() => {
    if (state?.success && !initial) {
      formRef.current?.reset();
      setAccountNo("");
    }
  }, [state, initial]);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        if (!confirmClosedYearWrite(String(fd.get("date") || ""), closedThroughYear)) return;
        formAction(fd);
      }}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <DebitCreditHelp accountNo={accountNo} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-[9rem_20rem_minmax(10rem,1fr)_7rem_7rem]">
        <Field label="Date">
          <input type="date" name="date" defaultValue={initial?.date} required className="input" />
        </Field>
        <Field label="Account">
          <AccountSelect accounts={accounts} name="account_no" required value={accountNo} onChange={setAccountNo} placeholder="Type to find an account" />
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={initial?.description ?? ""} className="input" />
        </Field>
        <Field label="Debit">
          <input type="number" step="any" name="debit" defaultValue={initial?.debit ?? 0} className="input" />
        </Field>
        <Field label="Credit">
          <input type="number" step="any" name="credit" defaultValue={initial?.credit ?? 0} className="input" />
        </Field>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
