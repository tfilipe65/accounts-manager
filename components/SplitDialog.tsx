"use client";

// A floating window to enter (or edit) a split transaction: one line on the bank statement divided between
// several accounts and/or invoices. Shows how much is still to be placed and will not save until it is nil.

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Modal from "@/components/Modal";
import AccountSelect from "@/components/AccountSelect";
import { createSplit, updateSplit, type SplitInput, type SplitLine } from "@/lib/actions/split-actions";
import type { AccountOption } from "@/lib/actions/reference-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import { formatMoney as fmt } from "@/lib/formatters";

type InvoiceOption = { id: number; label: string };
type Presets = {
  loanPrincipal: number | null;
  interestExpense: number | null;
  bankCharges: number | null;
  withholding: number | null;
  socialSecurity: number | null;
};

type Row = {
  key: number;
  kind: "account" | "sales" | "purchase";
  account_no: string;
  sales_invoice_id: string;
  purchase_invoice_id: string;
  employee_id: string;
  description: string;
  amount: string;
  vat: string; // percent
};

let nextKey = 1;
const blank = (over: Partial<Row> = {}): Row => ({
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

const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? 0 : Number(s));

export default function SplitDialog({
  bankAccountId,
  accounts,
  salesInvoices,
  purchaseInvoices,
  employees,
  vatRates,
  presets,
  closedThroughYear,
  defaultDate,
  initial,
  label,
  className,
  inline = false,
}: {
  bankAccountId: number;
  accounts: AccountOption[];
  salesInvoices: InvoiceOption[];
  purchaseInvoices: InvoiceOption[];
  employees: { id: number; name: string }[];
  vatRates: number[];
  presets: Presets;
  closedThroughYear: number | null;
  defaultDate: string;
  initial?: { splitId: string; input: SplitInput };
  label: string;
  className?: string;
  /** Open the split in the page itself (under the entry form, in #split-panel-host) instead of a floating window. */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(open && inline ? document.getElementById("split-panel-host") : null);
  }, [open, inline]);
  const formProps = { bankAccountId, accounts, salesInvoices, purchaseInvoices, employees, vatRates, presets, closedThroughYear, defaultDate, initial };
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => (inline ? !o : true))} className={className}>
        {inline && open ? "Close split" : label}
      </button>
      {inline && open && host && createPortal(
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="text-lg font-semibold text-primary">Split transaction</h2>
          <SplitForm {...formProps} onDone={() => setOpen(false)} />
        </div>,
        host
      )}
      {!inline && open && (
        <Modal title={initial ? "Edit split transaction" : "Split transaction"} onClose={() => setOpen(false)} wide>
          <SplitForm
            bankAccountId={bankAccountId}
            accounts={accounts}
            salesInvoices={salesInvoices}
            purchaseInvoices={purchaseInvoices}
            employees={employees}
            vatRates={vatRates}
            presets={presets}
            closedThroughYear={closedThroughYear}
            defaultDate={defaultDate}
            initial={initial}
            onDone={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

function SplitForm({
  bankAccountId,
  accounts,
  salesInvoices,
  purchaseInvoices,
  employees,
  vatRates,
  presets,
  closedThroughYear,
  defaultDate,
  initial,
  onDone,
}: {
  bankAccountId: number;
  accounts: AccountOption[];
  salesInvoices: InvoiceOption[];
  purchaseInvoices: InvoiceOption[];
  employees: { id: number; name: string }[];
  vatRates: number[];
  presets: Presets;
  closedThroughYear: number | null;
  defaultDate: string;
  initial?: { splitId: string; input: SplitInput };
  onDone: () => void;
}) {
  const start = initial?.input;
  const [date, setDate] = useState(start?.payment_date ?? defaultDate);
  const [direction, setDirection] = useState<"in" | "out">(start?.direction ?? "out");
  const [description, setDescription] = useState(start?.description ?? "");
  const [total, setTotal] = useState(start ? String(start.total) : "");
  const [rows, setRows] = useState<Row[]>(
    start
      ? start.lines.map((l) =>
          blank({
            kind: l.kind,
            account_no: l.account_no != null ? String(l.account_no) : "",
            sales_invoice_id: l.sales_invoice_id != null ? String(l.sales_invoice_id) : "",
            purchase_invoice_id: l.purchase_invoice_id != null ? String(l.purchase_invoice_id) : "",
            employee_id: l.employee_id != null ? String(l.employee_id) : "",
            description: l.description ?? "",
            amount: String(l.amount),
            vat: String(Math.round(l.vat_perc * 10000) / 100),
          })
        )
      : [blank(), blank()]
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const placed = rows.reduce((s, r) => s + num(r.amount), 0);
  const remaining = Math.round((num(total) - placed) * 100) / 100;
  const balanced = num(total) > 0 && Math.abs(remaining) < 0.005;

  const update = (key: number, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const accountOf = (n: number | null) => (n != null && accounts.some((a) => a.account_no === n) ? String(n) : "");

  const preset = (kind: "loan" | "state") => {
    if (kind === "loan") {
      setDirection("out");
      if (!description) setDescription("Loan instalment");
      setRows([
        blank({ account_no: accountOf(presets.loanPrincipal), description: "Principal repaid" }),
        blank({ account_no: accountOf(presets.interestExpense), description: "Interest" }),
        blank({ account_no: accountOf(presets.bankCharges), description: "Fees and charges" }),
      ]);
    } else {
      setDirection("out");
      if (!description) setDescription("Payment to the State");
      setRows([
        blank({ account_no: accountOf(presets.withholding), description: "IRS withheld from pay" }),
        blank({ account_no: accountOf(presets.socialSecurity), description: "Social security" }),
      ]);
    }
  };

  const save = () => {
    setError(null);
    if (!confirmClosedYearWrite(date, closedThroughYear)) return;
    const lines: SplitLine[] = rows.map((r) => ({
      kind: r.kind,
      account_no: r.kind === "account" && r.account_no ? Number(r.account_no) : null,
      sales_invoice_id: r.kind === "sales" && r.sales_invoice_id ? Number(r.sales_invoice_id) : null,
      purchase_invoice_id: r.kind === "purchase" && r.purchase_invoice_id ? Number(r.purchase_invoice_id) : null,
      employee_id: r.kind === "account" && r.employee_id ? Number(r.employee_id) : null,
      description: r.description.trim() || null,
      amount: num(r.amount),
      vat_perc: num(r.vat) / 100,
    }));
    const input: SplitInput = { bank_account_id: bankAccountId, payment_date: date, description: description.trim() || null, direction, total: num(total), lines };
    startTransition(async () => {
      const result = initial ? await updateSplit(initial.splitId, input) : await createSplit(input);
      if (result.error) setError(result.error);
      else onDone();
    });
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[9rem_9rem_11rem_minmax(10rem,1fr)]">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </Field>
        <Field label="Money">
          <select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")} className="input">
            <option value="out">Paid out (-)</option>
            <option value="in">Received (+)</option>
          </select>
        </Field>
        <Field label="Bank statement amount">
          <input type="number" step="0.01" min="0" value={total} onChange={(e) => setTotal(e.target.value)} className="input" autoFocus />
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
        </Field>
      </div>

      {!initial && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-neutral-500">Start from</span>
          <button type="button" onClick={() => preset("loan")} className="rounded-md border border-line px-2.5 py-1 hover:bg-background">
            Loan instalment (principal, interest, fees)
          </button>
          <button type="button" onClick={() => preset("state")} className="rounded-md border border-line px-2.5 py-1 hover:bg-background">
            Pay the State (IRS and social security)
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[48rem] table-fixed text-sm">
          <colgroup>
            <col style={{ width: "9rem" }} />
            <col style={{ width: "30%" }} />
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
                  <select value={r.kind} onChange={(e) => update(r.key, { kind: e.target.value as Row["kind"] })} className="input">
                    <option value="account">An account</option>
                    <option value="sales">Sales invoice paid</option>
                    <option value="purchase">Purchase invoice paid</option>
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
                    {Math.abs(remaining) >= 0.005 && num(r.amount) === 0 && (
                      <button type="button" title="Put what is left on this part" onClick={() => update(r.key, { amount: String(remaining) })} className="whitespace-nowrap rounded border border-line px-1.5 py-1 text-[11px] text-primary hover:bg-background">
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
                    <span className="text-xs text-neutral-400">in the invoice</span>
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
        <button type="button" onClick={() => setRows((all) => [...all, blank()])} className="rounded-md border border-line px-3 py-1.5 text-xs hover:bg-background">
          + Add a part
        </button>
        <div className="flex items-center gap-4">
          <span className="text-neutral-600">
            Placed <span className="font-semibold">{fmt(placed)}</span> of <span className="font-semibold">{fmt(num(total))}</span>
          </span>
          <span className={`rounded px-2 py-1 text-xs font-semibold ${balanced ? "bg-blue-50 text-[#1d5fbf]" : "bg-red-50 text-red-700"}`}>
            {balanced ? "Nothing left to place" : `Still to place: ${fmt(remaining)}`}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onDone} className="rounded-md border border-line px-4 py-2 text-sm hover:bg-background">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !balanced}
          onClick={save}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Save split"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        The parts are saved as one line on the bank statement: they are ticked together when reconciling and deleted together. VAT in an account part is
        taken to the VAT account, not to the expense. A negative amount goes the other way (for example a credit note deducted from a payment).
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
