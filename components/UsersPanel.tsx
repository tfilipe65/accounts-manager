"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserFormAction, deleteUserAction, saveUserSectionsAction } from "@/lib/actions/settings-form-actions";
import { SECTIONS } from "@/lib/sections";
import type { UserRow } from "@/lib/actions/settings-actions";

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
              <th className="px-4 py-2">Sections</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-background">
                <td className="px-4 py-2 font-medium">{u.username}</td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.role}</td>
                <td className="px-4 py-2">
                  {u.role === "ADMIN" ? <span className="text-neutral-500">All</span> : <SectionsEditor user={u} />}
                </td>
                <td className="px-4 py-2 text-right">
                  {u.id !== currentUserId && (
                    <form action={deleteUserAction.bind(null, u.id)}>
                      <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Username">
            <input name="username" required className="input" />
          </Field>
          <Field label="Name">
            <input name="name" required className="input" />
          </Field>
          <Field label="Password">
            <input name="password" type="password" required className="input" />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue="USER" className="input">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
        </div>
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
  const [state, action, pending] = useActionState(saveUserSectionsAction.bind(null, user.id), undefined);
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
