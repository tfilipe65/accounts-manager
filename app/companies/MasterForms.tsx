"use client";

import { useActionState } from "react";
import { setupMasterAction, masterLoginAction, addCompanyAction } from "@/lib/actions/company-actions";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}

const button = "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60";

export function SetupMasterForm() {
  const [state, action, pending] = useActionState(setupMasterAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Name">
        <input name="name" required className="input" />
      </Field>
      <Field label="Username">
        <input name="username" required autoComplete="username" className="input" />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="new-password" className="input" />
      </Field>
      <Field label="Repeat password">
        <input name="confirm" type="password" required autoComplete="new-password" className="input" />
      </Field>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Creating…" : "Create administrator"}
      </button>
    </form>
  );
}

export function MasterLoginForm() {
  const [state, action, pending] = useActionState(masterLoginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Username">
        <input name="username" required autoComplete="username" className="input" />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </Field>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Signing in…" : "Administrator sign in"}
      </button>
    </form>
  );
}

export function AddCompanyForm() {
  const [state, action, pending] = useActionState(addCompanyAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Company name">
          <input name="name" required className="input" />
        </Field>
        <Field label="What it does">
          <input name="description" className="input" />
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Adding…" : "Add company"}
        </button>
      </div>
    </form>
  );
}
