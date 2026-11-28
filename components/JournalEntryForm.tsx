"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { AccountOption } from "@/lib/actions/reference-actions";
import type { JournalEntryInput } from "@/lib/actions/journal-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import VatSelect from "@/components/VatSelect";
import AccountSelect from "@/components/AccountSelect";
import DebitCreditHelp from "@/components/DebitCreditHelp";
import BalanceHeadsUp from "@/components/BalanceHeadsUp";

type FormState = { error?: string; success?: boolean } | undefined;

export default function JournalEntryForm({
  accounts,
  action,
  initial,
  submitLabel = "Add entry",
  closedThroughYear,
  registerDiff = 0,
}: {
  accounts: AccountOption[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: JournalEntryInput;
  submitLabel?: string;
  closedThroughYear: number | null;
  /** Debits minus credits already saved in this register (whole register), for the out-of-balance warning. */
  registerDiff?: number;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [accountNo, setAccountNo] = useState<number | "">(initial?.account_no ?? "");
  const [debit, setDebit] = useState(initial?.debit ? String(initial.debit) : "");
  const [credit, setCredit] = useState(initial?.credit ? String(initial.credit) : "");

  useEffect(() => {
    // Only auto-reset the blank "add" form on success -- an edit form has
    // initial values to keep showing, and its action redirects away anyway.
    if (state?.success && !initial) {
      formRef.current?.reset();
      setAccountNo("");
      setDebit("");
      setCredit("");
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-[9rem_20rem_minmax(10rem,1fr)_6rem_7rem_7rem]">
        <Field label="Date">
          <input type="date" name="date" defaultValue={initial?.date} required className="input" />
        </Field>
        <Field label="Account">
          <AccountSelect accounts={accounts} name="account_no" required value={accountNo} onChange={setAccountNo} placeholder="Type to find an account" />
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={initial?.description ?? ""} className="input" />
        </Field>
        <Field label="VAT %">
          <VatSelect name="vat_perc" defaultValue={initial?.vat_perc ?? null} allowBlank />
        </Field>
        <Field label="Debit">
          <input type="number" step="any" name="debit" value={debit} onChange={(e) => setDebit(e.target.value)} className="input" />
        </Field>
        <Field label="Credit">
          <input type="number" step="any" name="credit" value={credit} onChange={(e) => setCredit(e.target.value)} className="input" />
        </Field>
      </div>

      <BalanceHeadsUp
        kind="journal"
        registerDiff={registerDiff}
        previous={initial ? { debit: initial.debit, credit: initial.credit } : undefined}
        debit={Number(debit) || 0}
        credit={Number(credit) || 0}
      />

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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
