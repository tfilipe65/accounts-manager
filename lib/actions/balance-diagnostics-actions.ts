"use server";

// Pinpoints WHERE an out-of-balance trial balance comes from, rather than
// just reporting that it's out of balance.
//
// Every other register in this schema is auto-balancing by construction: an
// invoice line's revenue is always paired with an implicit AR debit, a
// payment always moves both the bank ledger and the AR/AP balance by the
// same amount (see trial-balance-actions.ts's header comment). Those can
// only go out of balance if the *formula* has a bug -- which is what the
// stress-test discipline in trial-balance-actions.ts is for.
//
// opening_balances and journal_entries are different: each row is a single
// user-entered debit OR credit with no automatic counterpart. A correct
// opening balance sheet or a correct manual journal entry always nets to
// zero on its own (debits = credits within that one register) -- if it
// doesn't, that register is the culprit, not the formula. So: check each of
// those two registers' own debit/credit totals independently, and if their
// combined discrepancy accounts for the trial balance's discrepancy, we've
// identified the cause precisely. If it doesn't add up, say so rather than
// guessing -- that would point at a bug in the trial balance formula itself.

import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getTrialBalance } from "@/lib/actions/trial-balance-actions";

export type BalanceDiagnostics = {
  isBalanced: boolean;
  trialBalanceDiff: number; // debit - credit; positive means debits exceed credits
  openingBalanceDiff: number;
  journalDiff: number;
  explained: boolean; // whether opening + journal diffs fully account for the trial balance diff
};

export async function getBalanceDiagnostics(): Promise<BalanceDiagnostics> {
  await requireSession();

  const { totalDebit, totalCredit } = await getTrialBalance();
  const trialBalanceDiff = totalDebit - totalCredit;

  if (Math.abs(trialBalanceDiff) < 0.005) {
    return { isBalanced: true, trialBalanceDiff: 0, openingBalanceDiff: 0, journalDiff: 0, explained: true };
  }

  const ob = await query<{ debit: string; credit: string }>("SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit FROM opening_balances");
  const je = await query<{ debit: string; credit: string }>("SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit FROM journal_entries");

  const openingBalanceDiff = Number(ob[0].debit) - Number(ob[0].credit);
  const journalDiff = Number(je[0].debit) - Number(je[0].credit);

  const explained = Math.abs(openingBalanceDiff + journalDiff - trialBalanceDiff) < 0.005;

  return { isBalanced: false, trialBalanceDiff, openingBalanceDiff, journalDiff, explained };
}

/** Debits minus credits of the two hand-entered registers (every year). Zero means that register balances on its own. */
export async function getRegisterDiffs(): Promise<{ openingDiff: number; journalDiff: number }> {
  await requireSession();
  const ob = await query<{ d: string }>("SELECT COALESCE(SUM(debit - credit), 0) AS d FROM opening_balances");
  const je = await query<{ d: string }>("SELECT COALESCE(SUM(debit - credit), 0) AS d FROM journal_entries");
  return { openingDiff: Number(ob[0].d), journalDiff: Number(je[0].d) };
}
