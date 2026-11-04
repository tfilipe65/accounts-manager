"use server";

// Year-End Close guard. Every create/update/delete against a dated financial
// record (journal entries, opening balances, sales/purchase invoices, bank
// transactions) calls this first. A regular User is blocked outright once a
// year is closed; an Admin can still override (Tony's call -- matches how
// most real bookkeeping software behaves, e.g. correcting something an
// auditor found after close) but the client-side forms warn before
// submitting so it's never silent. See lib/actions/settings-actions.ts's
// closeYear()/reopenYear() for how closed_through_year gets set.

import { queryOne } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export async function getClosedThroughYear(): Promise<number | null> {
  const row = await queryOne<{ closed_through_year: number | null }>("SELECT closed_through_year FROM app_settings WHERE id = 1");
  return row?.closed_through_year ?? null;
}

export async function assertYearOpen(dateStr: string, session: SessionUser): Promise<void> {
  const closedThrough = await getClosedThroughYear();
  if (closedThrough == null) return;
  const year = Number(dateStr.slice(0, 4));
  if (year > closedThrough) return;
  if (session.role === "ADMIN") return; // Admin override -- confirmed client-side before submitting
  throw new Error(`${year} is closed. Ask an Admin to reopen it, or use a date in ${closedThrough + 1} or later.`);
}
