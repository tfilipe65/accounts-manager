"use client";

import { useActionState } from "react";
import { setupAdminAction } from "@/lib/actions/auth-actions";

const input = "rounded-md border border-line px-3 py-2 focus:outline-2 focus:outline-accent";
const label = "text-xs font-semibold uppercase tracking-wide text-neutral-600";

export default function SetupForm() {
  const [state, formAction, pending] = useActionState(setupAdminAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className={label}>Your name</label>
        <input id="name" name="name" autoFocus className={input} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className={label}>Username</label>
        <input id="username" name="username" autoComplete="username" className={input} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className={label}>Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" className={input} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className={label}>Repeat password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className={input} />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create administrator"}
      </button>
    </form>
  );
}
