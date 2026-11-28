"use client";

import { formatMoney as fmt } from "@/lib/formatters";

/**
 * Shown under an Opening Balance / Journal line while it is being typed: says what the register will look like
 * once this line is saved, and when that leaves it out of balance, what to do about it.
 *
 * `registerDiff` is debits minus credits of everything already saved in that register; `previous` is the line
 * being edited (its old effect is taken out first).
 */
export default function BalanceHeadsUp({
  kind,
  registerDiff,
  previous,
  debit,
  credit,
}: {
  kind: "opening" | "journal";
  registerDiff: number;
  previous?: { debit: number; credit: number };
  debit: number;
  credit: number;
}) {
  const net = debit - credit;
  if (Math.abs(net) < 0.005 && !previous) return null; // nothing typed yet: the page's own notice covers what is already saved
  const after = registerDiff - (previous ? previous.debit - previous.credit : 0) + net;
  const name = kind === "opening" ? "The opening balance" : "The journal";

  if (Math.abs(after) < 0.005) {
    if (Math.abs(registerDiff) < 0.005 && Math.abs(net) < 0.005) return null;
    return (
      <p className="rounded-md border border-debit/40 bg-debit/10 px-3 py-2 text-sm text-debit">
        ✓ With this line, {name.toLowerCase()} balances: total debits equal total credits.
      </p>
    );
  }

  const needsCredit = after > 0; // debits are ahead, so the missing line is a credit
  const side = needsCredit ? "credit" : "debit";
  return (
    <div className="flex flex-col gap-1 rounded-md border border-amber-500/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="font-semibold">
        ⚠ With this line {name.toLowerCase()} will be out of balance by {fmt(Math.abs(after))} ({needsCredit ? "debits exceed credits" : "credits exceed debits"}).
      </p>
      <p>
        {kind === "opening" ? (
          <>
            Every opening balance needs the same total in Debit and in Credit. After saving this line, add another with a <strong>{side}</strong> of{" "}
            <strong>{fmt(Math.abs(after))}</strong>
            {needsCredit ? (
              <>
                {" "}
                on where the money came from: <em>Share capital</em> if the owners put it in, <em>Retained earnings</em> if it is profit kept from earlier years, or a loan
                account if it was borrowed.
              </>
            ) : (
              <>
                {" "}
                on the account it belongs to (an asset such as the bank, stock or what clients owe), or <em>Retained earnings</em> if it is an accumulated loss.
              </>
            )}{" "}
            A button to add it in one click appears after you save.
          </>
        ) : (
          <>
            A journal entry always has two sides. After saving this line, add another with a <strong>{side}</strong> of <strong>{fmt(Math.abs(after))}</strong> on the
            other account involved (the account the money comes from or goes to).
          </>
        )}
      </p>
    </div>
  );
}
