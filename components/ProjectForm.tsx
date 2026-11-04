"use client";

import { useActionState } from "react";
import type { Project } from "@/lib/actions/project-actions";

const STATUSES = ["In Progress", "Job Delaid", "On Hold", "Restarted", "Completed", "Def. Liability", "Guarantee Period"];

type FormState = { error?: string } | undefined;

export default function ProjectForm({ action, initial }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; initial?: Project }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Code">
          <input name="code" defaultValue={initial?.code} required className="input" />
        </Field>
        <Field label="Name" className="md:col-span-2">
          <input name="name" defaultValue={initial?.name} required className="input" />
        </Field>
        <Field label="Start Date">
          <input type="date" name="start_date" defaultValue={initial?.start_date ?? ""} className="input" />
        </Field>
        <Field label="End Date">
          <input type="date" name="end_date" defaultValue={initial?.end_date ?? ""} className="input" />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={initial?.status ?? ""} className="input">
            <option value="">&mdash;</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Free Code 1">
          <input name="free_code_1" defaultValue={initial?.free_code_1 ?? ""} className="input" />
        </Field>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save project"}
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
