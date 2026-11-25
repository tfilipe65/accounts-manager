"use client";

import { useActionState } from "react";
import { loadSampleDataAction, startFreshAction } from "@/lib/actions/sample-data-actions";

type Result = { error?: string; success?: boolean; message?: string } | undefined;

export default function SampleDataPanel({ companyName }: { companyName: string }) {
  const [load, loadAction, loadPending] = useActionState(loadSampleDataAction, undefined as Result);
  const [fresh, freshAction, freshPending] = useActionState(startFreshAction, undefined as Result);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
      <p className="text-sm text-neutral-600">
        To see {companyName} working like a real business, load made-up sample data: clients, suppliers, staff, invoices raised and paid (some late), purchases, wages,
        IVA, transfers and petty cash from last January to today. When you are ready to use the app for real, start fresh. Both keep a backup first.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <form action={loadAction}>
          <button type="submit" disabled={loadPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {loadPending ? "Loading…" : "Load sample data"}
          </button>
        </form>
        <form
          action={(fd) => {
            if (!window.confirm(`Delete ALL entries and master data (clients, suppliers, invoices, bank entries, staff, projects) in ${companyName}? The chart of accounts, settings, bank accounts and logins stay. A backup is made first.`)) return;
            freshAction(fd);
          }}
        >
          <button type="submit" disabled={freshPending} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
            {freshPending ? "Clearing…" : "Start fresh (delete all data)"}
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
