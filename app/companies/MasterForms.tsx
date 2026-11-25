"use client";

import { useActionState } from "react";
import { setupMasterAction, masterLoginAction, addCompanyAction } from "@/lib/actions/company-actions";
import { loadSampleDataAllAction, startFreshAllAction } from "@/lib/actions/sample-data-actions";

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
        <Field label="Chart of accounts to start from">
          <select name="template" defaultValue="C" className="input">
            <option value="C">Construction</option>
            <option value="W">Carpentry and workshop</option>
            <option value="I">Decorations and design</option>
            <option value="P">Property management and rentals</option>
            <option value="K">Client money account</option>
          </select>
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

export function DemoDataForms() {
  const [load, loadAction, loadPending] = useActionState(loadSampleDataAllAction, undefined as { error?: string; success?: boolean; message?: string } | undefined);
  const [fresh, freshAction, freshPending] = useActionState(startFreshAllAction, undefined as { error?: string; success?: boolean; message?: string } | undefined);
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-primary">Sample data</h3>
      <p className="text-sm text-neutral-600">
        Fill every company that is still empty with made-up data so you can see the app working, or start fresh in every company when you are ready to go for real. Each
        company is backed up first.
      </p>
      <div className="flex flex-wrap gap-3">
        <form action={loadAction}>
          <button type="submit" disabled={loadPending} className={button}>
            {loadPending ? "Loading… this takes a little while" : "Load sample data into every empty company"}
          </button>
        </form>
        <form
          action={(fd) => {
            if (!window.confirm("Delete ALL entries and master data in EVERY company? Charts of accounts, settings, bank accounts and logins stay. Each company is backed up first.")) return;
            freshAction(fd);
          }}
        >
          <button type="submit" disabled={freshPending} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
            {freshPending ? "Clearing…" : "Start fresh in every company"}
          </button>
        </form>
      </div>
      {load?.error && <p className="text-sm text-red-700">{load.error}</p>}
      {load?.success && <p className="text-sm text-green-700">{load.message}</p>}
      {fresh?.error && <p className="text-sm text-red-700">{fresh.error}</p>}
      {fresh?.success && <p className="text-sm text-green-700">{fresh.message}</p>}
    </div>
  );
}
