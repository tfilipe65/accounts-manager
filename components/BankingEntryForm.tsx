"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createBankTransactionFormAction } from "@/lib/actions/banking-form-actions";
import type { AccountOption } from "@/lib/actions/reference-actions";
import type { BankTransactionInput } from "@/lib/actions/banking-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";

type InvoiceOption = { id: number; label: string };
type LinkType = "sales" | "purchase" | "account" | "none";
type FormState = { error?: string; success?: boolean } | undefined;

export default function BankingEntryForm({
  bankAccountId,
  accounts,
  salesInvoices,
  purchaseInvoices,
  action = createBankTransactionFormAction,
  initial,
  submitLabel = "Add entry",
  closedThroughYear,
}: {
  bankAccountId: number;
  accounts: AccountOption[];
  salesInvoices: InvoiceOption[];
  purchaseInvoices: InvoiceOption[];
  action?: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: BankTransactionInput;
  submitLabel?: string;
  closedThroughYear: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [linkType, setLinkType] = useState<LinkType>(initial?.link_type ?? "account");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Only auto-reset the blank "add" form on success -- an edit form has
    // initial values to keep showing, and its action redirects away anyway.
    if (state?.success && !initial) {
      formRef.current?.reset();
      setLinkType("account");
    }
  }, [state, initial]);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        if (!confirmClosedYearWrite(String(fd.get("payment_date") || ""), closedThroughYear)) return;
        formAction(fd);
      }}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <input type="hidden" name="bank_account_id" value={bankAccountId} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Date">
          <input type="date" name="payment_date" defaultValue={initial?.payment_date} required className="input" />
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={initial?.description ?? ""} className="input" />
        </Field>
        <Field label="In (+)">
          <input type="number" step="any" name="in_amount" defaultValue={initial?.in_amount ?? 0} className="input" />
        </Field>
        <Field label="In VAT">
          <input type="number" step="any" name="in_vat" defaultValue={initial?.in_vat ?? 0} className="input" />
        </Field>
        <Field label="Out (-)">
          <input type="number" step="any" name="out_amount" defaultValue={initial?.out_amount ?? 0} className="input" />
        </Field>
        <Field label="Out VAT">
          <input type="number" step="any" name="out_vat" defaultValue={initial?.out_vat ?? 0} className="input" />
        </Field>
        <Field label="VAT %">
          <input type="number" step="any" name="vat_perc" defaultValue={initial?.vat_perc ?? 0} className="input" />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Link this entry to</span>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["account", "An account (bank fee, transfer, ...)"],
              ["sales", "A sales invoice payment"],
              ["purchase", "A purchase invoice payment"],
              ["none", "Nothing"],
            ] as [LinkType, string][]
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="link_type"
                value={value}
                checked={linkType === value}
                onChange={() => setLinkType(value)}
              />
              {label}
            </label>
          ))}
        </div>

        {linkType === "account" && (
          <select name="account_no" className="input" defaultValue={initial?.account_no ?? ""}>
            <option value="" disabled>
              Select account
            </option>
            {accounts.map((a) => (
              <option key={a.account_no} value={a.account_no}>
                {a.account_no} {a.name}
              </option>
            ))}
          </select>
        )}
        {linkType === "sales" && (
          <select name="sales_invoice_id" className="input" defaultValue={initial?.sales_invoice_id ?? ""}>
            <option value="" disabled>
              Select sales invoice
            </option>
            {salesInvoices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        {linkType === "purchase" && (
          <select name="purchase_invoice_id" className="input" defaultValue={initial?.purchase_invoice_id ?? ""}>
            <option value="" disabled>
              Select purchase invoice
            </option>
            {purchaseInvoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
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
