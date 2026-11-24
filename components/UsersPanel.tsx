"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createUserFormAction,
  deleteUserFormAction,
  resetPasswordFormAction,
  saveUserSectionsAction,
  unlockUserFormAction,
  updateUserFormAction,
} from "@/lib/actions/settings-form-actions";
import type { UserRow } from "@/lib/actions/settings-actions";
import { SECTIONS } from "@/lib/sections";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

type FormState = { error?: string; success?: boolean } | undefined;

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function UsersPanel({ users, currentUserId }: { users: UserRow[]; currentUserId: number }) {
  const [state, formAction, pending] = useActionState(createUserFormAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last sign-in</th>
              <th className="px-4 py-2">Sections</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="align-top hover:bg-background">
                <td className="px-4 py-2 font-medium">{u.username}</td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.role === "ADMIN" ? "Admin" : "User"}</td>
                <td className="px-4 py-2">
                  {!u.active ? (
                    <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-semibold text-neutral-700">Switched off</span>
                  ) : u.locked ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">Locked</span>
                  ) : u.must_change_password ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">New password due</span>
                  ) : (
                    <span className="text-green-700">Active</span>
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-600">{formatWhen(u.last_login)}</td>
                <td className="px-4 py-2">{u.role === "ADMIN" ? <span className="text-neutral-500">All</span> : <SectionsEditor user={u} />}</td>
                <td className="px-4 py-2 text-right">
                  <ManageUser user={u} isSelf={u.id === currentUserId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold text-primary">Add a user</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Username">
            <input name="username" required className="input" />
          </Field>
          <Field label="Name">
            <input name="name" required className="input" />
          </Field>
          <Field label="Temporary password">
            <input name="password" type="password" required autoComplete="new-password" className="input" />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue="USER" className="input">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-neutral-500">
          At least {MIN_PASSWORD_LENGTH} characters with letters and numbers. They choose their own password the first time they sign in.
          Which sections a user may open is set afterwards, from the Sections column.
        </p>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add user"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionsEditor({ user }: { user: UserRow }) {
  const [state, action, pending] = useActionState(saveUserSectionsAction.bind(null, user.id), undefined as FormState);
  const summary = user.permissions === null ? "All" : `${user.permissions.length} of ${SECTIONS.length}`;
  return (
    <details>
      <summary className="cursor-pointer text-primary hover:underline">{summary}</summary>
      <form action={action} className="mt-2 flex flex-col gap-2 rounded-md border border-line bg-background p-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {SECTIONS.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="sections" value={s.key} defaultChecked={user.permissions === null || user.permissions.includes(s.key)} />
              {s.label}
            </label>
          ))}
        </div>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
          {state?.success && <span className="text-xs text-green-700">Saved</span>}
        </div>
      </form>
    </details>
  );
}

function ManageUser({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [edit, editAction, editPending] = useActionState(updateUserFormAction.bind(null, user.id), undefined as FormState);
  const [reset, resetAction, resetPending] = useActionState(resetPasswordFormAction.bind(null, user.id), undefined as FormState);
  const [unlock, unlockAction, unlockPending] = useActionState(unlockUserFormAction.bind(null, user.id), undefined as FormState);
  const [del, delAction, delPending] = useActionState(deleteUserFormAction.bind(null, user.id), undefined as FormState);
  return (
    <details className="text-left">
      <summary className="cursor-pointer text-right text-primary hover:underline">Manage</summary>
      <div className="mt-2 flex w-72 flex-col gap-3 rounded-md border border-line bg-background p-3">
        <form action={editAction} className="flex flex-col gap-2">
          <Field label="Name">
            <input name="name" defaultValue={user.name} required className="input" />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue={user.role} className="input">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={user.active} disabled={isSelf} />
            Login switched on
          </label>
          {isSelf && <input type="hidden" name="active" value="on" />}
          {edit?.error && <p className="text-xs text-red-700">{edit.error}</p>}
          {edit?.success && <p className="text-xs text-green-700">Saved</p>}
          <button type="submit" disabled={editPending} className="self-start rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            Save
          </button>
        </form>

        <form action={resetAction} className="flex flex-col gap-2 border-t border-line pt-3">
          <Field label="New temporary password">
            <input name="password" type="password" required autoComplete="new-password" className="input" />
          </Field>
          {reset?.error && <p className="text-xs text-red-700">{reset.error}</p>}
          {reset?.success && <p className="text-xs text-green-700">Password reset. They must change it at sign-in.</p>}
          <button type="submit" disabled={resetPending} className="self-start rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-60">
            Reset password
          </button>
        </form>

        {user.locked && (
          <form action={unlockAction} className="border-t border-line pt-3">
            {unlock?.error && <p className="text-xs text-red-700">{unlock.error}</p>}
            <button type="submit" disabled={unlockPending} className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-60">
              Unlock this login
            </button>
          </form>
        )}

        {!isSelf && (
          <form
            action={(fd) => {
              if (!confirm(`Delete the login "${user.username}"? This cannot be undone.`)) return;
              delAction(fd);
            }}
            className="border-t border-line pt-3"
          >
            {del?.error && <p className="mb-1 text-xs text-red-700">{del.error}</p>}
            <button type="submit" disabled={delPending} className="text-xs text-neutral-500 hover:text-red-700">
              Delete login
            </button>
          </form>
        )}
      </div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
