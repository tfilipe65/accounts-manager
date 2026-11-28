import { formatMoney as fmt } from "@/lib/formatters";
import { balanceOpeningAction } from "@/lib/actions/opening-balance-form-actions";

/** What is saved right now leaves this register out of balance: say so, and what to do. */
export default function RegisterBalanceNotice({ kind, diff }: { kind: "opening" | "journal"; diff: number }) {
  if (Math.abs(diff) < 0.005) return null;
  const needsCredit = diff > 0;
  const side = needsCredit ? "credit" : "debit";
  const amount = fmt(Math.abs(diff));
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-amber-500/70 bg-amber-50 p-4 text-amber-900">
      <p className="font-semibold">
        ⚠ {kind === "opening" ? "The opening balance" : "The journal"} is out of balance by {amount} ({needsCredit ? "debits exceed credits" : "credits exceed debits"}).
      </p>
      {kind === "opening" ? (
        <>
          <p className="text-sm">
            Total debits must equal total credits. To fix it, add a line with a <strong>{side}</strong> of <strong>{amount}</strong>
            {needsCredit
              ? " on where the money came from: Share capital (the owners put it in), Retained earnings (profit kept from earlier years) or a loan account (borrowed)."
              : " on the account it belongs to, such as the bank, stock or what clients owe; or on Retained earnings if it is an accumulated loss."}
          </p>
          <div className="flex flex-wrap gap-3">
            {needsCredit && (
              <form action={balanceOpeningAction.bind(null, "share_capital")}>
                <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark">
                  Credit {amount} to Share capital
                </button>
              </form>
            )}
            <form action={balanceOpeningAction.bind(null, "retained_earnings")}>
              <button type="submit" className="rounded-md border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-background">
                {needsCredit ? "Credit" : "Debit"} {amount} {needsCredit ? "to" : "on"} Retained earnings
              </button>
            </form>
          </div>
          <p className="text-xs">If neither fits (a loan, say), add the line yourself in the form above.</p>
        </>
      ) : (
        <p className="text-sm">
          Every journal entry needs the same debit as credit. Add a line with a <strong>{side}</strong> of <strong>{amount}</strong> on the other account involved, or
          correct the line that is wrong.
        </p>
      )}
    </div>
  );
}
