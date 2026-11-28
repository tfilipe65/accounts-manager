"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createBankAccountFormAction,
  updateBankAccountFormAction,
  setBankAccountActiveFormAction,
  deleteBankAccountFormAction,
} from "@/lib/actions/bank-account-form-actions";
import type { BankAccountSummary } from "@/lib/actions/banking-actions";
import { formatMoney as fmt } from "@/lib/formatters";

type FormState = { error?: string; success?: boolean } | undefined;
type ChartOption = { account_no: number; name: string };

export default function BankAccountsPanel({
  accounts,
  unlinked,
  counters,
  defaultCounter,
  defaultDate,
}: {
  accounts: BankAccountSummary[];
  unlinked: ChartOption[];
  counters: ChartOption[];
  defaultCounter: number | null;
  defaultDate: string;
}) {
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary">Manage bank accounts and cash boxes ({accounts.length})</summary>
      <div className="flex flex-col gap-4 border-t border-line p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Ledger account</th>
                <th className="px-3 py-2">IBAN</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {accounts.map((a) => (
                <tr key={a.id} className={`align-top ${a.active ? "" : "text-neutral-500"}`}>
                  <td className="px-3 py-2 font-medium">
                    {a.name}
                    {a.bank_name && <div className="text-xs font-normal text-neutral-500">{a.bank_name}</div>}
                  </td>
                  <td className="px-3 py-2">{a.is_cash ? "Cash" : "Bank"}</td>
                  <td className="px-3 py-2">{a.account_no}</td>
                  <td className="px-3 py-2">{a.iban}</td>
                  <td className="px-3 py-2 text-right">{fmt(a.balance)}</td>
                  <td className="px-3 py-2">{a.active ? "Open" : "Closed"}</td>
                  <td className="px-3 py-2 text-right">
                    <ManageAccount account={a} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddAccount unlinked={unlinked} counters={counters} defaultCounter={defaultCounter} defaultDate={defaultDate} />
      </div>
    </details>
  );
}

function ManageAccount({ account }: { account: BankAccountSummary }) {
  const [edit, editAction, editPending] = useActionState(updateBankAccountFormAction.bind(null, account.id), undefined as FormState);
  const [toggle, toggleAction, togglePending] = useActionState(
    setBankAccountActiveFormAction.bind(null, account.id, !account.active),
    undefined as FormState
  );
  const [del, delAction, delPending] = useActionState(deleteBankAccountFormAction.bind(null, account.id), undefined as FormState);
  return (
    <details className="text-left">
      <summary className="cursor-pointer text-right text-primary hover:underline">Manage</summary>
      <div className="mt-2 flex w-72 flex-col gap-3 rounded-md border border-line bg-background p-3">
        <form action={editAction} className="flex flex-col gap-2">
          <Field label="Name">
            <input name="name" defaultValue={account.name} required className="input" />
          </Field>
          <Field label="Type">
            <select name="kind" defaultValue={account.is_cash ? "cash" : "bank"} className="input">
              <option value="bank">Bank account</option>
              <option value="cash">Cash box / petty cash</option>
            </select>
          </Field>
          <Field label="Bank">
            <input name="bank_name" defaultValue={account.bank_name ?? ""} className="input" />
          </Field>
          <Field label="IBAN">
            <input name="iban" defaultValue={account.iban ?? ""} className="input" />
          </Field>
          {edit?.error && <p className="text-xs text-red-700">{edit.error}</p>}
          {edit?.success && <p className="text-xs text-green-700">Saved</p>}
          <button type="submit" disabled={editPending} className="self-start rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            Save
          </button>
        </form>
        <form action={toggleAction} className="flex flex-col gap-1 border-t border-line pt-3">
          {toggle?.error && <p className="text-xs text-red-700">{toggle.error}</p>}
          <button type="submit" disabled={togglePending} className="self-start rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-60">
            {account.active ? "Close this account" : "Reopen this account"}
          </button>
          {account.active && <span className="text-xs text-neutral-500">Closing hides it from the tabs and forms. Its history stays in every report.</span>}
        </form>
        <form
          action={(fd) => {
            if (!confirm(`Delete "${account.name}"? Only possible when it has no transactions.`)) return;
            delAction(fd);
          }}
          className="border-t border-line pt-3"
        >
          {del?.error && <p className="mb-1 text-xs text-red-700">{del.error}</p>}
          <button type="submit" disabled={delPending} className="text-xs text-neutral-500 hover:text-red-700">
            Delete (never used)
          </button>
        </form>
      </div>
    </details>
  );
}

function AddAccount({
  unlinked,
  counters,
  defaultCounter,
  defaultDate,
}: {
  unlinked: ChartOption[];
  counters: ChartOption[];
  defaultCounter: number | null;
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState(createBankAccountFormAction, undefined as FormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 rounded-md border border-line bg-background p-4">
      <h3 className="text-sm font-semibold text-primary">Add an account</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Name">
          <input name="name" required placeholder="e.g. Santander - Current" className="input" />
        </Field>
        <Field label="Type">
          <select name="kind" defaultValue="bank" className="input">
            <option value="bank">Bank account</option>
            <option value="cash">Cash box / petty cash</option>
          </select>
        </Field>
        <Field label="Bank">
          <input name="bank_name" className="input" />
        </Field>
        <Field label="IBAN">
          <input name="iban" className="input" />
        </Field>
        <Field label="Ledger account">
          <select name="chart_account_no" defaultValue="" className="input">
            <option value="">Create a new one</option>
            {unlinked.map((a) => (
              <option key={a.account_no} value={a.account_no}>
                Use {a.account_no} {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Opening balance">
          <input type="number" step="0.01" name="opening_balance" className="input" />
        </Field>
        <Field label="Opening date">
          <input type="date" name="opening_date" defaultValue={defaultDate} className="input" />
        </Field>
        <Field label="Set against">
          <select name="opening_counter_account_no" defaultValue={defaultCounter ?? ""} className="input">
            <option value="">(only if no opening balance)</option>
            {counters.map((a) => (
              <option key={a.account_no} value={a.account_no}>
                {a.account_no} {a.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-neutral-500">
        A new account gets its own ledger account automatically. An opening balance is booked as a balanced pair of opening entries: the bank on one side and the
        account you choose (normally Capital) on the other.
      </p>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Account added.</p>}
      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
          {pending ? "Adding…" : "Add account"}
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
