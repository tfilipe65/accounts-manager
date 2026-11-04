"use client";

import { useActionState } from "react";
import { closeYearFormAction, reopenYearFormAction } from "@/lib/actions/settings-form-actions";

export default function YearCloseForm({ closedThroughYear, nextYearToClose }: { closedThroughYear: number | null; nextYearToClose: number }) {
  const [closeState, closeFormAction, closePending] = useActionState(closeYearFormAction, undefined);
  const [reopenState, reopenFormAction, reopenPending] = useActionState(reopenYearFormAction, undefined);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">Year-End Close</h2>
      <p className="text-sm text-neutral-600">
        {closedThroughYear != null
          ? `Everything through ${closedThroughYear} is closed. A regular User can no longer add, edit, or delete a Journal Entry, Opening Balance, Invoice, or Banking entry dated in ${closedThroughYear} or earlier -- an Admin can still override, with a warning.`
          : "Nothing is closed yet -- anyone can add, edit, or delete an entry dated in any year."}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <form
          action={(fd) => {
            if (!window.confirm(`Close ${nextYearToClose}? Only an Admin will be able to add or edit entries dated in ${nextYearToClose} or earlier afterward.`)) return;
            closeFormAction(fd);
          }}
        >
          <button
            type="submit"
            disabled={closePending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {closePending ? "Closing…" : `Close ${nextYearToClose}`}
          </button>
        </form>

        {closedThroughYear != null && (
          <form
            action={(fd) => {
              if (!window.confirm(`Reopen everything through ${closedThroughYear}? This removes the lock entirely -- any year can be edited again until you close it once more.`)) return;
              reopenFormAction(fd);
            }}
          >
            <button
              type="submit"
              disabled={reopenPending}
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-background disabled:opacity-60"
            >
              {reopenPending ? "Reopening…" : "Reopen all"}
            </button>
          </form>
        )}
      </div>

      {closeState?.error && <p className="text-sm text-red-700">{closeState.error}</p>}
      {closeState?.success && <p className="text-sm text-debit">Closed.</p>}
      {reopenState?.error && <p className="text-sm text-red-700">{reopenState.error}</p>}
      {reopenState?.success && <p className="text-sm text-debit">Reopened.</p>}
    </div>
  );
}
