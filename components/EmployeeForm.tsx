"use client";

import { useActionState } from "react";
import type { Employee } from "@/lib/actions/employee-actions";

type FormState = { error?: string } | undefined;

export default function EmployeeForm({ action, initial }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; initial?: Employee }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Name" className="md:col-span-2">
          <input name="name" defaultValue={initial?.name} required className="input" />
        </Field>
        <Field label="Position">
          <input name="position" defaultValue={initial?.position ?? ""} className="input" />
        </Field>
        <Field label="NIF (tax number)">
          <input name="vat_number" defaultValue={initial?.vat_number ?? ""} className="input" />
        </Field>
        <Field label="Social security (NISS)">
          <input name="social_security_number" defaultValue={initial?.social_security_number ?? ""} className="input" />
        </Field>
        <Field label="IBAN">
          <input name="iban" defaultValue={initial?.iban ?? ""} className="input" />
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
        <Field label="Start date">
          <input type="date" name="start_date" defaultValue={initial?.start_date ?? ""} className="input" />
        </Field>
        <Field label="End date">
          <input type="date" name="end_date" defaultValue={initial?.end_date ?? ""} className="input" />
        </Field>
        <Field label="Monthly salary">
          <input type="number" step="0.01" name="monthly_salary" defaultValue={initial?.monthly_salary ?? ""} className="input" />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={initial?.status ?? "Active"} className="input">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Notes" className="md:col-span-3">
          <textarea name="notes" defaultValue={initial?.notes ?? ""} rows={2} className="input" />
        </Field>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
