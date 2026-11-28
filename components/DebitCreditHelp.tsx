// A short, plain-language guide to Debit and Credit for people who are not accountants. Shown above the Journal
// Entries and Opening Balance forms; once an account is picked it says in one line what Debit and Credit do to it.

import { ACCOUNT_GROUPS, groupOf } from "@/lib/account-groups";
import { useTx } from "@/components/TaxLabel";

// What people actually put in the two columns, by kind of account.
const ROWS: { groups: number[]; label: string; debit: string; credit: string }[] = [
  { groups: [4], label: "Bank, cash, customers owe you", debit: "Money comes in / you are owed more", credit: "Money goes out / you are owed less" },
  { groups: [5], label: "Equipment, vehicles, property", debit: "You buy something", credit: "You sell it or write it off" },
  { groups: [2, 3, 9], label: "Costs, expenses, tax", debit: "A cost is added", credit: "A cost is taken off (a refund)" },
  { groups: [1], label: "Income (sales)", debit: "Income is taken off (a refund)", credit: "A sale is added" },
  { groups: [6, 7], label: "Suppliers, VAT owed, loans", debit: "You pay some of it off", credit: "You owe more" },
  { groups: [8], label: "Owners' money", debit: "Owner takes money out, or a loss", credit: "Owner puts money in, or a profit" },
];

const rgbOf = (g: number) => ACCOUNT_GROUPS[g].rgb;

export default function DebitCreditHelp({ accountNo }: { accountNo?: number | "" }) {
  const tx = useTx();
  const group = accountNo ? groupOf(Number(accountNo)) : undefined;
  return (
    <details open className="rounded-md bg-background px-3 py-2 text-xs text-neutral-600">
      <summary className="cursor-pointer text-sm font-semibold text-neutral-700">Debit or credit? A quick guide</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p>
          Every entry has <strong>two sides</strong>: where something came <em>from</em> and where it went <em>to</em>. Debit and
          Credit are just the names of the two sides. Neither one means good or bad, and neither one means plus or minus: what it
          does depends on the kind of account. <strong>At the end, total Debits must equal total Credits.</strong>
        </p>

        <table className="w-full text-left">
          <thead>
            <tr className="text-[0.7rem] uppercase tracking-wide text-neutral-500">
              <th className="py-1 pr-3 font-semibold">Kind of account</th>
              <th className="py-1 pr-3 font-semibold">Debit (left side)</th>
              <th className="py-1 font-semibold">Credit (right side)</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={tx(r.label)} className="border-t border-line align-top">
                <td className="py-1 pr-3 font-medium text-neutral-700">
                  <span className="mr-1.5 inline-flex gap-0.5 align-middle">
                    {r.groups.map((g) => (
                      <span key={g} className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: `rgb(${rgbOf(g)})` }} />
                    ))}
                  </span>
                  {r.label}
                </td>
                <td className="py-1 pr-3">{r.debit}</td>
                <td className="py-1">{r.credit}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>
          <strong>Example:</strong> you pay a €100 fuel bill from the bank &rarr; Debit <em>Fuel</em> €100 (the cost goes up) and
          Credit <em>Bank</em> €100 (the money goes out).
        </p>

        {group ? (
          <p className="rounded border-l-4 bg-surface px-2 py-1.5 text-neutral-700" style={{ borderLeftColor: `rgb(${group.rgb})` }}>
            <strong>{group.label} account:</strong> a <strong>Debit</strong> means {group.debit}; a <strong>Credit</strong> means{" "}
            {group.credit}.
          </p>
        ) : (
          <p className="text-neutral-500">Pick an account below and this tells you what Debit and Credit do to it.</p>
        )}
      </div>
    </details>
  );
}
