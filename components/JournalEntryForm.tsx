"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountOption } from "@/lib/actions/reference-actions";
import { createJournalGroup, updateJournalGroup, type JournalEntryInput } from "@/lib/actions/journal-actions";
import { createJournalEntryFormAction } from "@/lib/actions/journal-form-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import { formatMoney as fmt } from "@/lib/formatters";
import VatSelect from "@/components/VatSelect";
import AccountSelect from "@/components/AccountSelect";
import DebitCreditHelp from "@/components/DebitCreditHelp";
import BalanceHeadsUp from "@/components/BalanceHeadsUp";

type FormState = { error?: string; success?: boolean } | undefined;

type Extra = { key: number; account_no: number | ""; description: string; vat: number | null; debit: string; credit: string };
let nextKey = 1;
const blankExtra = (over: Partial<Extra> = {}): Extra => ({ key: nextKey++, account_no: "", description: "", vat: null, debit: "", credit: "", ...over });
const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? 0 : Number(s));

export default function JournalEntryForm({
  accounts,
  action = createJournalEntryFormAction,
  initial,
  initialGroup,
  submitLabel = "Add entry",
  closedThroughYear,
  registerDiff = 0,
}: {
  accounts: AccountOption[];
  action?: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: JournalEntryInput;
  /** An existing multi-line entry being edited: the form opens already in multi-line mode, filled in. */
  initialGroup?: { entryId: string; lines: JournalEntryInput[] };
  submitLabel?: string;
  closedThroughYear: number | null;
  /** Debits minus credits already saved in this register (whole register), for the out-of-balance warning. */
  registerDiff?: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const first = initial ?? initialGroup?.lines[0];
  const [accountNo, setAccountNo] = useState<number | "">(first?.account_no ?? "");
  const [debit, setDebit] = useState(first?.debit ? String(first.debit) : "");
  const [credit, setCredit] = useState(first?.credit ? String(first.credit) : "");

  const [multi, setMulti] = useState(!!initialGroup);
  const [extras, setExtras] = useState<Extra[]>(
    initialGroup && initialGroup.lines.length > 1
      ? initialGroup.lines.slice(1).map((l) =>
          blankExtra({
            account_no: l.account_no,
            description: l.description ?? "",
            vat: l.vat_perc,
            debit: l.debit ? String(l.debit) : "",
            credit: l.credit ? String(l.credit) : "",
          })
        )
      : [blankExtra()]
  );
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);

  const totalDebit = num(debit) + extras.reduce((s, e) => s + num(e.debit), 0);
  const totalCredit = num(credit) + extras.reduce((s, e) => s + num(e.credit), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = Math.abs(difference) < 0.005 && totalDebit > 0;

  const resetAll = () => {
    formRef.current?.reset();
    setAccountNo("");
    setDebit("");
    setCredit("");
    setExtras([blankExtra()]);
    setMulti(false);
    setGroupError(null);
  };

  useEffect(() => {
    // Only auto-reset the blank "add" form on success -- an edit form has
    // initial values to keep showing, and its action redirects away anyway.
    if (state?.success && !initial && !initialGroup) resetAll();
  }, [state, initial, initialGroup]);

  const updateExtra = (key: number, patch: Partial<Extra>) => setExtras((all) => all.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  async function submitGroup(fd: FormData) {
    setGroupError(null);
    const date = String(fd.get("date") || "");
    if (!date) return setGroupError("Date is required.");
    if (!confirmClosedYearWrite(date, closedThroughYear)) return;
    const description = String(fd.get("description") || "").trim() || null;
    const vat = fd.get("vat_perc");
    const lines: JournalEntryInput[] = [
      { date, account_no: Number(accountNo) || 0, description, vat_perc: vat ? Number(vat) : null, debit: num(debit), credit: num(credit) },
      ...extras.map((e) => ({
        date,
        account_no: Number(e.account_no) || 0,
        description: e.description.trim() || description,
        vat_perc: e.vat,
        debit: num(e.debit),
        credit: num(e.credit),
      })),
    ];
    setGroupBusy(true);
    const result = initialGroup ? await updateJournalGroup(initialGroup.entryId, lines) : await createJournalGroup(lines);
    setGroupBusy(false);
    if (result.error) return setGroupError(result.error);
    if (initialGroup) router.push("/journal");
    else resetAll();
  }

  const busy = pending || groupBusy;

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        if (multi) {
          await submitGroup(fd);
          return;
        }
        if (!confirmClosedYearWrite(String(fd.get("date") || ""), closedThroughYear)) return;
        formAction(fd);
      }}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <DebitCreditHelp accountNo={accountNo} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-[9rem_20rem_minmax(10rem,1fr)_6rem_7rem_7rem]">
        <Field label="Date">
          <input type="date" name="date" defaultValue={first?.date} required className="input" />
        </Field>
        <Field label={multi ? "Account (line 1)" : "Account"}>
          <AccountSelect accounts={accounts} name="account_no" required value={accountNo} onChange={setAccountNo} placeholder="Type to find an account" />
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={first?.description ?? ""} className="input" />
        </Field>
        <Field label="VAT %">
          <VatSelect name="vat_perc" defaultValue={first?.vat_perc ?? null} allowBlank />
        </Field>
        <Field label="Debit">
          <input type="number" step="any" name="debit" value={debit} onChange={(e) => setDebit(e.target.value)} className="input" />
        </Field>
        <Field label="Credit">
          <input type="number" step="any" name="credit" value={credit} onChange={(e) => setCredit(e.target.value)} className="input" />
        </Field>
      </div>

      {multi && (
        <div className="flex flex-col gap-3 border-t border-line pt-3 text-sm">
          <span className="font-semibold text-primary">The other lines of this entry (same date)</span>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[54rem] table-fixed text-sm">
              <colgroup>
                <col style={{ width: "20rem" }} />
                <col />
                <col style={{ width: "6rem" }} />
                <col style={{ width: "8rem" }} />
                <col style={{ width: "8rem" }} />
                <col style={{ width: "4.5rem" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  <th className="px-2 py-2">Account</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">VAT %</th>
                  <th className="px-2 py-2 text-right">Debit</th>
                  <th className="px-2 py-2 text-right">Credit</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {extras.map((e) => (
                  <tr key={e.key} className="align-top">
                    <td className="px-2 py-2">
                      <AccountSelect accounts={accounts} value={e.account_no} onChange={(n) => updateExtra(e.key, { account_no: n })} placeholder="Type to find an account" />
                    </td>
                    <td className="px-2 py-2">
                      <input value={e.description} onChange={(ev) => updateExtra(e.key, { description: ev.target.value })} placeholder="same as above" className="input" />
                    </td>
                    <td className="px-2 py-2">
                      <VatSelect value={e.vat} onChange={(v) => updateExtra(e.key, { vat: v })} allowBlank />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <input type="number" step="any" value={e.debit} onChange={(ev) => updateExtra(e.key, { debit: ev.target.value })} className="input text-right" />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" step="any" value={e.credit} onChange={(ev) => updateExtra(e.key, { credit: ev.target.value })} className="input text-right" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      {extras.length > 1 && (
                        <button type="button" onClick={() => setExtras((all) => all.filter((x) => x.key !== e.key))} className="text-xs text-neutral-500 hover:text-red-700">
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
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setExtras((all) => [...all, blankExtra()])} className="rounded-md border border-line px-3 py-1.5 text-xs hover:bg-background">
                + Add a line
              </button>
              {Math.abs(difference) >= 0.005 && (
                <button
                  type="button"
                  title="Put what is missing on the last line"
                  onClick={() =>
                    setExtras((all) =>
                      all.map((x, i) =>
                        i === all.length - 1
                          ? { ...x, debit: difference < 0 ? String(Math.abs(difference) + num(x.debit) - num(x.credit)) : "", credit: difference > 0 ? String(difference + num(x.credit) - num(x.debit)) : "" }
                          : x
                      )
                    )
                  }
                  className="rounded-md border border-line px-3 py-1.5 text-xs text-primary hover:bg-background"
                >
                  Balance with the last line
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-neutral-600">
                Debits <span className="font-semibold">{fmt(totalDebit)}</span> &middot; Credits <span className="font-semibold">{fmt(totalCredit)}</span>
              </span>
              <span className={`rounded px-2 py-1 text-xs font-semibold ${balanced ? "bg-blue-50 text-[#1d5fbf]" : "bg-red-50 text-red-700"}`}>
                {balanced ? "Balanced" : totalDebit === 0 && totalCredit === 0 ? "Enter the amounts" : `${difference > 0 ? "Credit" : "Debit"} still needed: ${fmt(Math.abs(difference))}`}
              </span>
            </div>
          </div>
          <p className="text-xs text-neutral-500">The lines are saved together as one entry, which only saves when total debits equal total credits.</p>
        </div>
      )}

      {!multi && (
        <BalanceHeadsUp
          kind="journal"
          registerDiff={registerDiff}
          previous={initial ? { debit: initial.debit, credit: initial.credit } : undefined}
          debit={num(debit)}
          credit={num(credit)}
        />
      )}

      {(multi ? groupError : state?.error) && <p className="text-sm text-red-700">{multi ? groupError : state?.error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || (multi && !balanced)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {!initial && !initialGroup && (
          <>
            <span className="text-sm text-neutral-400">or</span>
            <button
              type="button"
              onClick={() => {
                setGroupError(null);
                setMulti((m) => !m);
              }}
              className="whitespace-nowrap rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-background"
            >
              {multi ? "Cancel split" : "Split entry"}
            </button>
            {!multi && <span className="text-xs text-neutral-500">One entry with several lines, such as a payment shared between a cost, VAT and a loan. It saves only when debits equal credits.</span>}
          </>
        )}
      </div>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
