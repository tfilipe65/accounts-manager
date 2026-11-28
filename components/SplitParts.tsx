"use client";

// The parts of a split transaction, shown under the normal entry form when "Split transaction" is chosen: one
// row per place the statement line goes (an account, a sales or purchase invoice, or nothing), with how much
// is still to be placed.

import AccountSelect from "@/components/AccountSelect";
import type { AccountOption } from "@/lib/actions/reference-actions";
import { formatMoney as fmt } from "@/lib/formatters";

export type InvoiceOption = { id: number; label: string };
export type Presets = {
  loanPrincipal: number | null;
  interestExpense: number | null;
  bankCharges: number | null;
  withholding: number | null;
  socialSecurity: number | null;
};

export type SplitRow = {
  key: number;
  kind: "account" | "sales" | "purchase" | "none";
  account_no: string;
  sales_invoice_id: string;
  purchase_invoice_id: string;
  employee_id: string;
  description: string;
  amount: string;
  vat: string; // percent
};

let nextKey = 1;
export const blankRow = (over: Partial<SplitRow> = {}): SplitRow => ({
  key: nextKey++,
  kind: "account",
  account_no: "",
  sales_invoice_id: "",
  purchase_invoice_id: "",
  employee_id: "",
  description: "",
  amount: "",
  vat: "0",
  ...over,
});

export const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? 0 : Number(s));

/** The parts that a one-click starting point fills in. */
export function presetRows(kind: "loan" | "state", presets: Presets, accounts: AccountOption[]): { description: string; rows: SplitRow[] } {
  const accountOf = (n: number | null) => (n != null && accounts.some((a) => a.account_no === n) ? String(n) : "");
  if (kind === "loan") {
    return {
      description: "Loan instalment",
      rows: [
        blankRow({ account_no: accountOf(presets.loanPrincipal), description: "Principal repaid" }),
        blankRow({ account_no: accountOf(presets.interestExpense), description: "Interest" }),
        blankRow({ account_no: accountOf(presets.bankCharges), description: "Fees and charges" }),
      ],
    };
  }
  return {
    description: "Payment to the State",
    rows: [
      blankRow({ account_no: accountOf(presets.withholding), description: "IRS withheld from pay" }),
      blankRow({ account_no: accountOf(presets.socialSecurity), description: "Social security" }),
    ],
  };
}

export default function SplitParts({
  rows,
  setRows,
  total,
  accounts,
  salesInvoices,
  purchaseInvoices,
  employees,
  vatRates,
}: {
  rows: SplitRow[];
  setRows: React.Dispatch<React.SetStateAction<SplitRow[]>>;
  /** What the bank statement shows (the In or Out amount above). */
  total: number;
  accounts: AccountOption[];
  salesInvoices: InvoiceOption[];
  purchaseInvoices: InvoiceOption[];
  employees: { id: number; name: string }[];
  vatRates: number[];
}) {
  const placed = rows.reduce((s, r) => s + num(r.amount), 0);
  const remaining = Math.round((total - placed) * 100) / 100;
  const balanced = total > 0 && Math.abs(remaining) < 0.005;
  const update = (key: number, patch: Partial<SplitRow>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[54rem] table-fixed text-sm">
          <colgroup>
            <col style={{ width: "13rem" }} />
            <col style={{ width: "28%" }} />
            <col />
            <col style={{ width: "9.5rem" }} />
            <col style={{ width: "5.5rem" }} />
            <col style={{ width: "4rem" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-2 py-2">Part is</th>
              <th className="px-2 py-2">Account or invoice</th>
              <th className="px-2 py-2">Note</th>
              <th className="px-2 py-2 text-right">Amount (incl. VAT)</th>
              <th className="px-2 py-2">VAT %</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key} className="align-top">
                <td className="px-2 py-2">
                  <select value={r.kind} onChange={(e) => update(r.key, { kind: e.target.value as SplitRow["kind"] })} className="input">
                    <option value="account">An account</option>
                    <option value="sales">Sales invoice paid</option>
                    <option value="purchase">Purchase invoice paid</option>
                    <option value="none">N/A (not linked)</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  {r.kind === "account" && (
                    <div className="flex flex-col gap-1">
                      <AccountSelect accounts={accounts} value={r.account_no} onChange={(n) => update(r.key, { account_no: n === "" ? "" : String(n) })} />
                      {employees.length > 0 && (
                        <select value={r.employee_id} onChange={(e) => update(r.key, { employee_id: e.target.value })} className="input text-xs">
                          <option value="">No employee</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  {r.kind === "none" && <span className="block py-2 text-xs text-neutral-500">Not linked to an account or an invoice: it only moves the bank balance.</span>}
                  {r.kind === "sales" && (
                    <select value={r.sales_invoice_id} onChange={(e) => update(r.key, { sales_invoice_id: e.target.value })} className="input">
                      <option value="">Select sales invoice</option>
                      {salesInvoices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {r.kind === "purchase" && (
                    <select value={r.purchase_invoice_id} onChange={(e) => update(r.key, { purchase_invoice_id: e.target.value })} className="input">
                      <option value="">Select purchase invoice</option>
                      {purchaseInvoices.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-2 py-2">
                  <input value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} className="input" />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.01" value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} className="input text-right" />
                    {Math.abs(remaining) >= 0.005 && num(r.amount) === 0 && total > 0 && (
                      <button
                        type="button"
                        title="Put what is left on this part"
                        onClick={() => update(r.key, { amount: String(remaining) })}
                        className="whitespace-nowrap rounded border border-line px-1.5 py-1 text-[11px] text-primary hover:bg-background"
                      >
                        rest
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2">
                  {r.kind === "account" ? (
                    <select value={r.vat} onChange={(e) => update(r.key, { vat: e.target.value })} className="input">
                      <option value="0">0%</option>
                      {vatRates
                        .filter((v) => v > 0)
                        .map((v) => (
                          <option key={v} value={Math.round(v * 10000) / 100}>
                            {Math.round(v * 10000) / 100}%
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-xs text-neutral-400">{r.kind === "none" ? "none" : "in the invoice"}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  {rows.length > 2 && (
                    <button type="button" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} className="text-xs text-neutral-500 hover:text-red-700">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setRows((all) => [...all, blankRow()])} className="rounded-md border border-line px-3 py-1.5 text-xs hover:bg-background">
          + Add a part
        </button>
        <div className="flex items-center gap-4">
          <span className="text-neutral-600">
            Placed <span className="font-semibold">{fmt(placed)}</span> of <span className="font-semibold">{fmt(total)}</span>
          </span>
          <span className={`rounded px-2 py-1 text-xs font-semibold ${balanced ? "bg-blue-50 text-[#1d5fbf]" : "bg-red-50 text-red-700"}`}>
            {total <= 0 ? "Enter the statement amount in In or Out above" : balanced ? "Nothing left to place" : `Still to place: ${fmt(remaining)}`}
          </span>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        The parts are saved as one line on the bank statement: they are ticked together when reconciling and deleted together. VAT in an account part is
        taken to the VAT account, not to the expense. A negative amount goes the other way (for example a credit note deducted from a payment).
      </p>
    </div>
  );
}
