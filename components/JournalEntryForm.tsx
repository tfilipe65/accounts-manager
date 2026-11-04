"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { AccountOption } from "@/lib/actions/reference-actions";
import type { JournalEntryInput } from "@/lib/actions/journal-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";

type FormState = { error?: string; success?: boolean } | undefined;

export default function JournalEntryForm({
  accounts,
  action,
  initial,
  submitLabel = "Add entry",
  closedThroughYear,
}: {
  accounts: AccountOption[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: JournalEntryInput;
  submitLabel?: string;
  closedThroughYear: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [accountNo, setAccountNo] = useState<number | "">(initial?.account_no ?? "");
  const selected = accounts.find((a) => a.account_no === accountNo);

  useEffect(() => {
    // Only auto-reset the blank "add" form on success -- an edit form has
    // initial values to keep showing, and its action redirects away anyway.
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
      <div className="rounded-md bg-background px-3 py-2 text-xs text-neutral-600">
        <strong className="text-neutral-700">Debit or credit?</strong> Debit <em>increases</em> assets and expenses (bank, cash,
        receivables, cost accounts) and <em>decreases</em> income, liabilities and equity. Credit does the opposite: it{" "}
        <em>increases</em> income, liabilities and equity, and <em>decreases</em> assets and expenses. Pick an account below and
        this will tell you which side normally increases it.
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Field label="Date">
          <input type="date" name="date" defaultValue={initial?.date} required className="input" />
        </Field>
        <Field label="Account" className="md:col-span-2">
          <select
            name="account_no"
            required
            value={accountNo}
            onChange={(e) => setAccountNo(e.target.value ? Number(e.target.value) : "")}
            className="input"
          >
            <option value="" disabled>
              Select
            </option>
            {accounts.map((a) => (
              <option key={a.account_no} value={a.account_no}>
                {a.account_no} {a.name}
              </option>
            ))}
          </select>
          {selected && (
            <span className="text-xs text-neutral-500">
              {selected.normal_balance === "debit"
                ? "This account increases with a Debit, decreases with a Credit."
                : "This account increases with a Credit, decreases with a Debit."}
            </span>
          )}
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={initial?.description ?? ""} className="input" />
        </Field>
        <Field label="VAT %">
          <input type="number" step="any" name="vat_perc" defaultValue={initial?.vat_perc ?? ""} className="input" />
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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
