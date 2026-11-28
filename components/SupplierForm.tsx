"use client";

import { useActionState } from "react";
import type { Supplier } from "@/lib/actions/supplier-actions";
import { useTx } from "@/components/TaxLabel";

type FormState = { error?: string } | undefined;

export default function SupplierForm({ action, initial }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; initial?: Supplier }) {
  const tx = useTx();
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Name" className="md:col-span-2">
          <input name="name" defaultValue={initial?.name} required className="input" />
        </Field>
        <Field label="Contact">
          <input name="contact" defaultValue={initial?.contact ?? ""} className="input" />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <input name="address" defaultValue={initial?.address ?? ""} className="input" />
        </Field>
        <Field label="Zip">
          <input name="zip" defaultValue={initial?.zip ?? ""} className="input" />
        </Field>
        <Field label="City">
          <input name="city" defaultValue={initial?.city ?? ""} className="input" />
        </Field>
        <Field label="Country">
          <input name="country" defaultValue={initial?.country ?? ""} className="input" />
        </Field>
        <Field label="Telephone">
          <input name="telephone" defaultValue={initial?.telephone ?? ""} className="input" />
        </Field>
        <Field label="Email">
          <input name="email" defaultValue={initial?.email ?? ""} className="input" />
        </Field>
        <Field label="Payment Term (days)">
          <input type="number" name="payment_term_days" defaultValue={initial?.payment_term_days ?? ""} className="input" />
        </Field>
        <Field label={tx("VAT Number")}>
          <input name="vat_number" defaultValue={initial?.vat_number ?? ""} className="input" />
        </Field>
        <Field label="COC Number">
          <input name="coc_number" defaultValue={initial?.coc_number ?? ""} className="input" />
        </Field>
        <Field label="Intra-Community">
          <select name="intra_community" defaultValue={initial?.intra_community ?? ""} className="input">
            <option value="">&mdash;</option>
            <option value="EU">EU</option>
            <option value="NON-EU">NON-EU</option>
          </select>
        </Field>
        <Field label="Free Code 1">
          <input name="free_code_1" defaultValue={initial?.free_code_1 ?? ""} className="input" />
        </Field>
        <Field label="Free Code 2">
          <input name="free_code_2" defaultValue={initial?.free_code_2 ?? ""} className="input" />
        </Field>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save supplier"}
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
