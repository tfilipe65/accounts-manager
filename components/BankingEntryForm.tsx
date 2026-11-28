"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBankTransactionFormAction } from "@/lib/actions/banking-form-actions";
import type { AccountOption } from "@/lib/actions/reference-actions";
import type { BankTransactionInput } from "@/lib/actions/banking-actions";
import { createSplit, updateSplit, type SplitInput, type SplitLine } from "@/lib/actions/split-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import VatSelect from "@/components/VatSelect";
import AccountSelect from "@/components/AccountSelect";
import SplitParts, { blankRow, num, presetRows, type Presets, type SplitRow } from "@/components/SplitParts";

type InvoiceOption = { id: number; label: string };
type LinkType = "sales" | "purchase" | "account" | "none";
type FormState = { error?: string; success?: boolean } | undefined;

export default function BankingEntryForm({
  bankAccountId,
  bankAccountKey,
  accounts,
  salesInvoices,
  purchaseInvoices,
  employees = [],
  action = createBankTransactionFormAction,
  initial,
  submitLabel = "Add entry",
  closedThroughYear,
  split,
  initialSplit,
}: {
  bankAccountId: number;
  /** Where to go after saving an edited split. */
  bankAccountKey?: string;
  accounts: AccountOption[];
  salesInvoices: InvoiceOption[];
  purchaseInvoices: InvoiceOption[];
  employees?: { id: number; name: string }[];
  action?: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: BankTransactionInput;
  submitLabel?: string;
  closedThroughYear: number | null;
  /** Turns on "Split transaction": one statement line that belongs in several places, entered in this same form. */
  split?: { vatRates: number[]; presets: Presets };
  /** An existing split being edited: the form opens already split, filled in. */
  initialSplit?: { splitId: string; input: SplitInput };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [linkType, setLinkType] = useState<LinkType>(initial?.link_type ?? "account");
  const formRef = useRef<HTMLFormElement>(null);

  const start = initialSplit?.input;
  const [splitMode, setSplitMode] = useState(!!initialSplit);
  const [rows, setRows] = useState<SplitRow[]>(
    start
      ? start.lines.map((l) =>
          blankRow({
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
      : [blankRow(), blankRow()]
  );
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitBusy, setSplitBusy] = useState(false);

  const [description, setDescription] = useState(start?.description ?? initial?.description ?? "");
  const [inAmt, setInAmt] = useState(start ? (start.direction === "in" ? String(start.total) : "") : initial?.in_amount ? String(initial.in_amount) : "");
  const [outAmt, setOutAmt] = useState(start ? (start.direction === "out" ? String(start.total) : "") : initial?.out_amount ? String(initial.out_amount) : "");

  // VAT is only entered here for an entry with no invoice behind it (a bank fee, a till receipt). A payment of an
  // invoice carries its VAT on the invoice. An older entry that already holds VAT keeps showing it. A split has
  // its VAT per part, so the VAT boxes go.
  const hadVat = !!initial && (initial.in_vat !== 0 || initial.out_vat !== 0);
  const showVat = !splitMode && (linkType === "account" || hadVat);
  const splitTotal = num(inAmt) > 0 ? num(inAmt) : num(outAmt);
  const placed = rows.reduce((s, r) => s + num(r.amount), 0);
  const splitBalanced = splitTotal > 0 && Math.abs(splitTotal - placed) < 0.005;

  const resetAll = () => {
    formRef.current?.reset();
    setLinkType("account");
    setDescription("");
    setInAmt("");
    setOutAmt("");
    setRows([blankRow(), blankRow()]);
    setSplitMode(false);
    setSplitError(null);
  };

  useEffect(() => {
    // Only auto-reset the blank "add" form on success -- an edit form has
    // initial values to keep showing, and its action redirects away anyway.
    if (state?.success && !initial) resetAll();
  }, [state, initial]);

  const loadPreset = (kind: "loan" | "state") => {
    if (!split) return;
    const p = presetRows(kind, split.presets, accounts);
    if (!description.trim()) setDescription(p.description);
    setRows(p.rows);
    setInAmt("");
  };

  async function submitSplit(fd: FormData) {
    setSplitError(null);
    const date = String(fd.get("payment_date") || "");
    if (!date) return setSplitError("Enter the date.");
    if (!confirmClosedYearWrite(date, closedThroughYear)) return;
    if (num(inAmt) > 0 && num(outAmt) > 0) return setSplitError("Fill in In (+) or Out (-), not both: it is one line on the bank statement.");
    if (splitTotal <= 0) return setSplitError("Enter the amount shown on the bank statement in In (+) or Out (-).");
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
    const input: SplitInput = {
      bank_account_id: bankAccountId,
      payment_date: date,
      description: description.trim() || null,
      direction: num(inAmt) > 0 ? "in" : "out",
      total: splitTotal,
      lines,
    };
    setSplitBusy(true);
    const result = initialSplit ? await updateSplit(initialSplit.splitId, input) : await createSplit(input);
    setSplitBusy(false);
    if (result.error) return setSplitError(result.error);
    if (initialSplit) router.push(`/banking${bankAccountKey ? `?account=${bankAccountKey}` : ""}`);
    else resetAll();
  }

  const busy = pending || splitBusy;

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        if (splitMode) {
          await submitSplit(fd);
          return;
        }
        if (!confirmClosedYearWrite(String(fd.get("payment_date") || ""), closedThroughYear)) return;
        if (!showVat) {
          fd.set("in_vat", "0");
          fd.set("out_vat", "0");
          fd.delete("vat_perc");
        }
        formAction(fd);
      }}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <input type="hidden" name="bank_account_id" value={bankAccountId} />

      <div
        className={`grid grid-cols-2 gap-4 md:grid-cols-4 ${
          showVat ? "xl:grid-cols-[9rem_minmax(10rem,1fr)_7rem_6rem_7rem_6rem_6rem]" : "xl:grid-cols-[9rem_minmax(10rem,1fr)_8rem_8rem]"
        }`}
      >
        <Field label="Date">
          <input type="date" name="payment_date" defaultValue={initial?.payment_date ?? start?.payment_date} required className="input" />
        </Field>
        <Field label="Description">
          <input name="description" value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
        </Field>
        <Field label="In (+)">
          <input type="number" step="any" name="in_amount" value={inAmt} onChange={(e) => setInAmt(e.target.value)} className="input" />
        </Field>
        <Field label="In VAT" hidden={!showVat}>
          <input type="number" step="any" name="in_vat" defaultValue={initial?.in_vat || ""} className="input" />
        </Field>
        <Field label="Out (-)">
          <input type="number" step="any" name="out_amount" value={outAmt} onChange={(e) => setOutAmt(e.target.value)} className="input" />
        </Field>
        <Field label="Out VAT" hidden={!showVat}>
          <input type="number" step="any" name="out_vat" defaultValue={initial?.out_vat || ""} className="input" />
        </Field>
        <Field label="VAT %" hidden={!showVat}>
          <VatSelect name="vat_perc" defaultValue={initial?.vat_perc ?? 0} />
        </Field>
      </div>

      {!splitMode && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Link this entry to</span>
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                ["account", "An account (bank fee, wages, ...)"],
                ["sales", "A sales invoice payment"],
                ["purchase", "A purchase invoice payment"],
                ["none", "Nothing"],
              ] as [LinkType, string][]
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5">
                <input type="radio" name="link_type" value={value} checked={linkType === value} onChange={() => setLinkType(value)} />
                {label}
              </label>
            ))}
          </div>

          {linkType === "account" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[22rem_18rem]">
              <AccountSelect accounts={accounts} name="account_no" defaultValue={initial?.account_no ?? ""} required placeholder="Type to find an account" />
              {employees.length > 0 && (
                <select name="employee_id" className="input" defaultValue={initial?.employee_id ?? ""}>
                  <option value="">No employee (not a payment to staff)</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {linkType === "sales" && (
            <select name="sales_invoice_id" className="input max-w-2xl" defaultValue={initial?.sales_invoice_id ?? ""}>
              <option value="" disabled>
                Select sales invoice
              </option>
              {salesInvoices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
          {linkType === "purchase" && (
            <select name="purchase_invoice_id" className="input max-w-2xl" defaultValue={initial?.purchase_invoice_id ?? ""}>
              <option value="" disabled>
                Select purchase invoice
              </option>
              {purchaseInvoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {splitMode && split && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-sm font-semibold text-primary">Split: where does this statement line go?</span>
            {!initialSplit && (
              <>
                <span className="ml-2 font-semibold uppercase tracking-wide text-neutral-500">Start from</span>
                <button type="button" onClick={() => loadPreset("loan")} className="rounded-md border border-line px-2.5 py-1 hover:bg-background">
                  Loan instalment (principal, interest, fees)
                </button>
                <button type="button" onClick={() => loadPreset("state")} className="rounded-md border border-line px-2.5 py-1 hover:bg-background">
                  Pay the State (IRS and social security)
                </button>
              </>
            )}
          </div>
          <SplitParts
            rows={rows}
            setRows={setRows}
            total={splitTotal}
            accounts={accounts}
            salesInvoices={salesInvoices}
            purchaseInvoices={purchaseInvoices}
            employees={employees}
            vatRates={split.vatRates}
          />
        </div>
      )}

      {(splitMode ? splitError : state?.error) && <p className="text-sm text-red-700">{splitMode ? splitError : state?.error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || (splitMode && !splitBalanced)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : splitMode && !initialSplit ? "Add split entry" : submitLabel}
        </button>
        {split && !initialSplit && (
          <>
            <span className="text-sm text-neutral-400">or</span>
            <button
              type="button"
              onClick={() => {
                setSplitError(null);
                setSplitMode((m) => !m);
              }}
              className="whitespace-nowrap rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-background"
            >
              {splitMode ? "Cancel split" : "Split transaction"}
            </button>
            {!splitMode && (
              <span className="text-xs text-neutral-500">One line on the statement that belongs in several places, such as a loan instalment or a payment to the State.</span>
            )}
          </>
        )}
      </div>
    </form>
  );
}

function Field({ label, children, hidden }: { label: string; children: React.ReactNode; hidden?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${hidden ? "hidden" : ""}`}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
