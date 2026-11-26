"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { transferFormAction, reconcileThroughFormAction } from "@/lib/actions/banking-form-actions";
import { setBankTransactionReconciled } from "@/lib/actions/banking-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import { formatMoney as fmt } from "@/lib/formatters";

type FormState = { error?: string; success?: boolean } | undefined;

/** Move money between two of our own accounts. */
export function TransferForm({
  accounts,
  fromId,
  defaultDate,
  closedThroughYear,
  isAdmin = false,
  unlinked = [],
}: {
  accounts: { id: number; name: string }[];
  fromId: number;
  defaultDate: string;
  closedThroughYear: number | null;
  isAdmin?: boolean;
  /** Bank-type chart accounts that are not set up as bank accounts yet (administrators only). */
  unlinked?: { account_no: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(transferFormAction, undefined as FormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);
  const other = accounts.find((a) => a.id !== fromId)?.id ?? "";
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">Transfer between accounts</summary>
      <form
        ref={formRef}
        action={(fd) => {
          if (!confirmClosedYearWrite(String(fd.get("date") || ""), closedThroughYear)) return;
          action(fd);
        }}
        className="flex flex-col gap-3 border-t border-line p-4"
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="From">
            <select name="from_bank_account_id" defaultValue={fromId} className="input">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To">
            <select name="to_bank_account_id" defaultValue={other} className="input">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" name="date" defaultValue={defaultDate} required className="input" />
          </Field>
          <Field label="Amount">
            <input type="number" step="0.01" min="0.01" name="amount" required className="input" />
          </Field>
          <Field label="Note">
            <input name="description" className="input" />
          </Field>
        </div>
        <p className="text-xs text-neutral-500">Records the money going out of one account and into the other as a pair. It is left out of money in / money out totals.</p>
        <p className="text-xs text-neutral-500">
          {!isAdmin ? (
            <>Account missing from the lists? Ask the administrator to add it as a bank account.</>
          ) : unlinked.length > 0 ? (
            <>
              Account missing from the lists? These ledger accounts are not set up as bank accounts yet:{" "}
              <strong className="text-neutral-700">{unlinked.map((a) => `${a.account_no} ${a.name}`).join(", ")}</strong>. Add them under{" "}
              <em>Manage bank accounts and cash boxes</em>{" "}
              (Ledger account: Use &hellip;).
            </>
          ) : (
            <>
              Account missing from the lists? Add it under <em>Manage bank accounts and cash boxes</em>.
            </>
          )}
        </p>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.success && <p className="text-sm text-green-700">Transfer recorded.</p>}
        <div>
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {pending ? "Saving…" : "Record transfer"}
          </button>
        </div>
      </form>
    </details>
  );
}

/** One tick box per register line: matched against the bank statement. */
export function ReconcileToggle({ id, checked }: { id: number; checked: boolean }) {
  const [value, setValue] = useState(checked);
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="checkbox"
      checked={value}
      disabled={pending}
      title={value ? "Matched with the bank statement" : "Not yet matched with the bank statement"}
      onChange={(e) => {
        const next = e.target.checked;
        setValue(next);
        startTransition(async () => {
          await setBankTransactionReconciled(id, next);
        });
      }}
    />
  );
}

/** Reconciliation helper: tick everything up to a statement date, and show what is still unmatched. */
export function ReconcilePanel({
  bankAccountId,
  bookBalance,
  reconciledBalance,
  unreconciledCount,
  defaultDate,
}: {
  bankAccountId: number;
  bookBalance: number;
  reconciledBalance: number;
  unreconciledCount: number;
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState(reconcileThroughFormAction.bind(null, bankAccountId), undefined as (FormState & { count?: number }) | undefined);
  const [statement, setStatement] = useState("");
  const statementNumber = statement === "" ? null : Number(statement);
  const difference = statementNumber == null || Number.isNaN(statementNumber) ? null : statementNumber - reconciledBalance;
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">
        Reconcile with the bank statement{unreconciledCount > 0 ? ` (${unreconciledCount} lines not yet matched)` : ""}
      </summary>
      <div className="flex flex-col gap-3 border-t border-line p-4 text-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Book balance</span>
            <span className="text-lg font-semibold text-primary">{fmt(bookBalance)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Matched balance (ticked lines only)</span>
            <span className="text-lg font-semibold text-primary">{fmt(reconciledBalance)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Closing balance on your statement</span>
            <input type="number" step="0.01" value={statement} onChange={(e) => setStatement(e.target.value)} className="input" placeholder="0.00" />
            {difference != null && (
              <span className={Math.abs(difference) < 0.005 ? "text-green-700" : "text-red-700"}>
                {Math.abs(difference) < 0.005 ? "Matches the ticked lines." : `Difference: ${fmt(difference)}`}
              </span>
            )}
          </div>
        </div>
        <form action={action} className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Tick every line up to</label>
            <input type="date" name="through" defaultValue={defaultDate} className="input" />
          </div>
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            Tick them
          </button>
          {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
          {state?.success && <span className="text-sm text-green-700">{state.count} lines ticked. Refresh the page to see them.</span>}
        </form>
        <p className="text-xs text-neutral-500">
          Tick the lines that appear on your statement, then type the statement&apos;s closing balance. When the difference is zero, the account agrees with the bank.
        </p>
      </div>
    </details>
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
