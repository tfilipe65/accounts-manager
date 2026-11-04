"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth-actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoFocus
          autoComplete="username"
          className="rounded-md border border-line px-3 py-2 focus:outline-2 focus:outline-accent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="rounded-md border border-line px-3 py-2 focus:outline-2 focus:outline-accent"
        />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
