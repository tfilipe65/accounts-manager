"use client";

import { useActionState } from "react";
import { closeYearFormAction, reopenYearFormAction } from "@/lib/actions/settings-form-actions";
import { useTx } from "@/components/TaxLabel";

// An optional lock on finished years. It posts nothing and the books work the same without it; it only
// stops a regular User from changing entries in a year that has already been filed (QuickBooks calls
// this the "closing date"). Administrators can still change locked years, with a warning.
export default function YearCloseForm({
  closedThroughYear,
  nextYearToClose,
  canClose,
}: {
  closedThroughYear: number | null;
  nextYearToClose: number;
  canClose: boolean;
}) {
  const tx = useTx();
  const [closeState, closeFormAction, closePending] = useActionState(closeYearFormAction, undefined);
  const [reopenState, reopenFormAction, reopenPending] = useActionState(reopenYearFormAction, undefined);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Lock finished years</h2>
        <p className="text-xs text-neutral-500">Optional. Nothing here is needed to keep the books.</p>
      </div>
      <p className="text-sm text-neutral-600">
        {closedThroughYear != null
          ? `Everything through ${closedThroughYear} is locked: a regular User can no longer add, change or delete an invoice, bank entry, journal entry or opening balance dated in ${closedThroughYear} or earlier. An Admin still can, with a warning.`
          : tx("Once a year has been filed (IVA, IRC), you can lock it so nobody changes it by accident. Until then every year can be edited.")}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {canClose ? (
          <form
            action={(fd) => {
              if (!window.confirm(`Lock everything through ${nextYearToClose}? A regular User will no longer be able to change entries dated ${nextYearToClose} or earlier.`)) return;
              closeFormAction(fd);
            }}
          >
            <button
              type="submit"
              disabled={closePending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {closePending ? "Locking…" : `Lock through ${nextYearToClose}`}
            </button>
          </form>
        ) : (
          <span className="text-sm text-neutral-500">{nextYearToClose} is still in progress, so there is no finished year to lock yet.</span>
        )}

        {closedThroughYear != null && (
          <form
            action={(fd) => {
              if (!window.confirm(`Unlock everything through ${closedThroughYear}? Any year can then be edited again until you lock one again.`)) return;
              reopenFormAction(fd);
            }}
          >
            <button
              type="submit"
              disabled={reopenPending}
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-background disabled:opacity-60"
            >
              {reopenPending ? "Unlocking…" : "Unlock all"}
            </button>
          </form>
        )}
      </div>

      {closeState?.error && <p className="text-sm text-red-700">{closeState.error}</p>}
      {closeState?.success && <p className="text-sm text-debit">Locked.</p>}
      {reopenState?.error && <p className="text-sm text-red-700">{reopenState.error}</p>}
      {reopenState?.success && <p className="text-sm text-debit">Unlocked.</p>}
    </div>
  );
}
