"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createBankTransactionFormAction } from "@/lib/actions/banking-form-actions";
import type { AccountOption } from "@/lib/actions/reference-actions";
import type { BankTransactionInput } from "@/lib/actions/banking-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import VatSelect from "@/components/VatSelect";
import AccountSelect from "@/components/AccountSelect";

type InvoiceOption = { id: number; label: string };
type LinkType = "sales" | "purchase" | "account" | "none";
type FormState = { error?: string; success?: boolean } | undefined;

export default function BankingEntryForm({
  bankAccountId,
  accounts,
  salesInvoices,
  purchaseInvoices,
  employees = [],
  action = createBankTransactionFormAction,
  initial,
  submitLabel = "Add entry",
  closedThroughYear,
  splitSlot,
}: {
  bankAccountId: number;
  accounts: AccountOption[];
  salesInvoices: InvoiceOption[];
  purchaseInvoices: InvoiceOption[];
  employees?: { id: number; name: string }[];
  action?: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: BankTransactionInput;
  submitLabel?: string;
  closedThroughYear: number | null;
  /** The Split transaction button, shown beside Add entry (one statement line that belongs in several places). */
  splitSlot?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [linkType, setLinkType] = useState<LinkType>(initial?.link_type ?? "account");
  const formRef = useRef<HTMLFormElement>(null);
  // VAT is only entered here for an entry with no invoice behind it (a bank fee, a till receipt). A payment of an
  // invoice carries its VAT on the invoice. An older entry that already holds VAT keeps showing it.
  const hadVat = !!initial && (initial.in_vat !== 0 || initial.out_vat !== 0);
  const showVat = linkType === "account" || hadVat;

  useEffect(() => {
    // Only auto-reset the blank "add" form on success -- an edit form has
    // initial values to keep showing, and its action redirects away anyway.
    if (state?.success && !initial) {
      formRef.current?.reset();
      setLinkType("account");
    }
  }, [state, initial]);

  return (
    <>
    <form
      ref={formRef}
      action={(fd) => {
        if (!confirmClosedYearWrite(String(fd.get("payment_date") || ""), closedThroughYear)) return;
        if (!showVat) {
          fd.set("in_vat", "0");
          fd.set("out_vat", "0");
          fd.delete("vat_perc");
        }
        formAction(fd);
      }}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <input type="hidden" name="bank_account_id" value={bankAccountId} />

      <div
        className={`grid grid-cols-2 gap-4 md:grid-cols-4 ${
          showVat ? "xl:grid-cols-[9rem_minmax(10rem,1fr)_7rem_6rem_7rem_6rem_6rem]" : "xl:grid-cols-[9rem_minmax(10rem,1fr)_8rem_8rem]"
        }`}
      >
        <Field label="Date">
          <input type="date" name="payment_date" defaultValue={initial?.payment_date} required className="input" />
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={initial?.description ?? ""} className="input" />
        </Field>
        <Field label="In (+)">
          <input type="number" step="any" name="in_amount" defaultValue={initial?.in_amount || ""} className="input" />
        </Field>
        <Field label="In VAT" hidden={!showVat}>
          <input type="number" step="any" name="in_vat" defaultValue={initial?.in_vat || ""} className="input" />
        </Field>
        <Field label="Out (-)">
          <input type="number" step="any" name="out_amount" defaultValue={initial?.out_amount || ""} className="input" />
        </Field>
        <Field label="Out VAT" hidden={!showVat}>
          <input type="number" step="any" name="out_vat" defaultValue={initial?.out_vat || ""} className="input" />
        </Field>
        <Field label="VAT %" hidden={!showVat}>
          <VatSelect name="vat_perc" defaultValue={initial?.vat_perc ?? 0} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Link this entry to</span>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["account", "An account (bank fee, wages, ...)"],
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[22rem_18rem]">
            <AccountSelect accounts={accounts} name="account_no" defaultValue={initial?.account_no ?? ""} required placeholder="Type to find an account" />
            {employees.length > 0 && (
              <select name="employee_id" className="input" defaultValue={initial?.employee_id ?? ""}>
                <option value="">No employee (not a payment to staff)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {linkType === "sales" && (
          <select name="sales_invoice_id" className="input max-w-2xl" defaultValue={initial?.sales_invoice_id ?? ""}>
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
          <select name="purchase_invoice_id" className="input max-w-2xl" defaultValue={initial?.purchase_invoice_id ?? ""}>
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {splitSlot && (
          <>
            <span className="text-sm text-neutral-400">or</span>
            {splitSlot}
            <span className="text-xs text-neutral-500">One line on the statement that belongs in several places, such as a loan instalment or a payment to the State.</span>
          </>
        )}
      </div>
    </form>
    {splitSlot && <div id="split-panel-host" className="empty:hidden" />}
    </>
  );
}

function Field({ label, children, hidden }: { label: string; children: React.ReactNode; hidden?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${hidden ? "hidden" : ""}`}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
