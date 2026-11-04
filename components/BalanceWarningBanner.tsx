import Link from "next/link";
import type { BalanceDiagnostics } from "@/lib/actions/balance-diagnostics-actions";
import { formatMoney as fmt } from "@/lib/formatters";

export default function BalanceWarningBanner({ diagnostics }: { diagnostics: BalanceDiagnostics }) {
  if (diagnostics.isBalanced) return null;

  const obOff = Math.abs(diagnostics.openingBalanceDiff) > 0.005;
  const jeOff = Math.abs(diagnostics.journalDiff) > 0.005;

  return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-credit bg-credit/10 p-4">
      <p className="font-semibold text-credit">
        ⚠ The books are out of balance by {fmt(Math.abs(diagnostics.trialBalanceDiff))} (
        {diagnostics.trialBalanceDiff > 0 ? "debits exceed credits" : "credits exceed debits"}).
      </p>
      {diagnostics.explained ? (
        <ul className="list-inside list-disc text-sm text-credit">
          {obOff && (
            <li>
              <Link href="/opening-balance" className="underline">
                Opening Balance
              </Link>{" "}
              is unbalanced by {fmt(Math.abs(diagnostics.openingBalanceDiff))} &mdash; its own debit and credit totals don&apos;t
              match. Check the entries there.
            </li>
          )}
          {jeOff && (
            <li>
              <Link href="/journal" className="underline">
                Journal Entries
              </Link>{" "}
              are unbalanced by {fmt(Math.abs(diagnostics.journalDiff))} &mdash; every manual journal entry needs a matching debit
              and credit somewhere. Check the entries there.
            </li>
          )}
        </ul>
      ) : (
        <p className="text-sm text-credit">
          This doesn&apos;t fully match a known cause (Opening Balance or Journal Entries) &mdash; it may be a bug in how the
          Trial Balance is calculated rather than a data entry mistake. Worth a closer look before trusting the reports.
        </p>
      )}
    </div>
  );
}
