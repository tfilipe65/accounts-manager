"use client";

import { useActionState, useState } from "react";
import type { AccountOption, NamedOption, ProjectOption } from "@/lib/actions/reference-actions";
import type { PurchaseInvoiceDetail, PurchaseInvoiceLineInput } from "@/lib/actions/expense-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import VatSelect from "@/components/VatSelect";

const BLANK_LINE: PurchaseInvoiceLineInput = {
  description: "",
  account_no: 0,
  project_id: null,
  vat_perc: 0.23,
  amount_inc_vat: 0,
  remarks: null,
  free_code_1: null,
  free_code_2: null,
};

type FormState = { error?: string } | undefined;

export default function ExpenseForm({
  suppliers,
  accounts,
  projects,
  action,
  initial,
  closedThroughYear,
}: {
  suppliers: NamedOption[];
  accounts: AccountOption[];
  projects: ProjectOption[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: PurchaseInvoiceDetail;
  closedThroughYear: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [lines, setLines] = useState<PurchaseInvoiceLineInput[]>(initial?.lines.length ? initial.lines : [{ ...BLANK_LINE }]);

  function updateLine(i: number, patch: Partial<PurchaseInvoiceLineInput>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { ...BLANK_LINE }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const gross = lines.reduce((s, l) => s + l.amount_inc_vat, 0);
  const vat = lines.reduce((s, l) => s + (l.amount_inc_vat - l.amount_inc_vat / (1 + l.vat_perc)), 0);

  return (
    <form
      action={(fd) => {
        if (!confirmClosedYearWrite(String(fd.get("date") || ""), closedThroughYear)) return;
        formAction(fd);
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="lines_json" value={JSON.stringify(lines)} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Invoice #">
          <input name="invoice_number" defaultValue={initial?.invoice_number} required className="input" />
        </Field>
        <Field label="Date">
          <input type="date" name="date" defaultValue={initial?.date} required className="input" />
        </Field>
        <Field label="Supplier">
          <select name="supplier_id" defaultValue={initial?.supplier_id ?? ""} required className="input">
            <option value="" disabled>
              Select supplier
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[56rem] table-fixed text-sm">
          <colgroup>
            <col />
            <col style={{ width: "20rem" }} />
            <col style={{ width: "6rem" }} />
            <col style={{ width: "5rem" }} />
            <col style={{ width: "7rem" }} />
            <col style={{ width: "10rem" }} />
            <col style={{ width: "5rem" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2">Account</th>
              <th className="px-2 py-2">Project</th>
              <th className="px-2 py-2">VAT %</th>
              <th className="px-2 py-2">Amount Inc. VAT</th>
              <th className="px-2 py-2">Remarks</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="p-1">
                  <input className="input" value={l.description ?? ""} onChange={(e) => updateLine(i, { description: e.target.value })} />
                </td>
                <td className="p-1">
                  <select
                    className="input"
                    value={l.account_no || ""}
                    onChange={(e) => updateLine(i, { account_no: Number(e.target.value) })}
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    {accounts.map((a) => (
                      <option key={a.account_no} value={a.account_no}>
                        {a.account_no} {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <select
                    className="input"
                    value={l.project_id ?? ""}
                    onChange={(e) => updateLine(i, { project_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">&mdash;</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1 w-20">
                  <VatSelect value={l.vat_perc} onChange={(v) => updateLine(i, { vat_perc: v })} />
                </td>
                <td className="p-1 w-32">
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={l.amount_inc_vat}
                    onChange={(e) => updateLine(i, { amount_inc_vat: Number(e.target.value) })}
                  />
                </td>
                <td className="p-1">
                  <input className="input" value={l.remarks ?? ""} onChange={(e) => updateLine(i, { remarks: e.target.value })} />
                </td>
                <td className="p-1">
                  <button type="button" onClick={() => removeLine(i)} className="text-neutral-500 hover:text-red-700">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addLine} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-background">
          + Add line
        </button>
        <div className="text-sm text-neutral-600">
          Net: <span className="font-semibold text-foreground">{(gross - vat).toFixed(2)}</span> &middot; VAT:{" "}
          <span className="font-semibold text-foreground">{vat.toFixed(2)}</span> &middot; Gross:{" "}
          <span className="font-semibold text-foreground">{gross.toFixed(2)}</span>
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save invoice"}
        </button>
      </div>
    </form>
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
