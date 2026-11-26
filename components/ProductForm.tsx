"use client";

import { useActionState } from "react";
import type { Product } from "@/lib/actions/product-actions";
import VatSelect from "@/components/VatSelect";

type FormState = { error?: string } | undefined;

export default function ProductForm({ action, initial }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; initial?: Product }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Name" className="md:col-span-2">
          <input name="name" defaultValue={initial?.name} required className="input" />
        </Field>
        <Field label="Unit">
          <input name="unit" defaultValue={initial?.unit ?? ""} className="input" />
        </Field>
        <Field label="Price ex. VAT">
          <input type="number" step="any" name="price_ex_vat" defaultValue={initial?.price_ex_vat ?? ""} className="input" />
        </Field>
        <Field label="VAT %">
          <VatSelect name="vat_perc" defaultValue={initial?.vat_perc ?? null} allowBlank />
        </Field>
        <Field label="Free Code 1">
          <input name="free_code_1" defaultValue={initial?.free_code_1 ?? ""} className="input" />
        </Field>
        <Field label="Free Code 2">
          <input name="free_code_2" defaultValue={initial?.free_code_2 ?? ""} className="input" />
        </Field>
        <Field label="Free Code 3">
          <input name="free_code_3" defaultValue={initial?.free_code_3 ?? ""} className="input" />
        </Field>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
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
