"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction } from "@/lib/actions/auth-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold text-primary">Change password</h2>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        Current password
        <input name="current" type="password" required autoComplete="current-password" className="input font-normal normal-case" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        New password
        <input name="next" type="password" required autoComplete="new-password" className="input font-normal normal-case" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        Repeat new password
        <input name="confirm" type="password" required autoComplete="new-password" className="input font-normal normal-case" />
      </label>
      <p className="text-xs text-neutral-500">At least {MIN_PASSWORD_LENGTH} characters, with letters and numbers.</p>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Password changed.</p>}
      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
          {pending ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
