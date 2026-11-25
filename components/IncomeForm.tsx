"use client";

import { useActionState, useState } from "react";
import type { AccountOption, NamedOption, ProjectOption, ProductOption } from "@/lib/actions/reference-actions";
import type { SalesInvoiceDetail, SalesInvoiceLineInput } from "@/lib/actions/income-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";

const DOC_TYPES = ["Invoice", "Credit Note", "Proforma", "Commission", "Tax Refund", "Interest", "Other"];

const BLANK_LINE: SalesInvoiceLineInput = {
  product_service_id: null,
  subject: "",
  quantity: 1,
  price_ex_vat: 0,
  vat_perc: 0.23,
  discount_perc: 0,
  account_no: 0,
  project_id: null,
  free_code: null,
};

type FormState = { error?: string } | undefined;

export default function IncomeForm({
  customers,
  accounts,
  projects,
  products,
  action,
  initial,
  closedThroughYear,
}: {
  customers: NamedOption[];
  accounts: AccountOption[];
  projects: ProjectOption[];
  products: ProductOption[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: SalesInvoiceDetail;
  closedThroughYear: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [lines, setLines] = useState<SalesInvoiceLineInput[]>(initial?.lines.length ? initial.lines : [{ ...BLANK_LINE }]);

  function updateLine(i: number, patch: Partial<SalesInvoiceLineInput>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { ...BLANK_LINE }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function onProductChange(i: number, productId: string) {
    const id = productId ? Number(productId) : null;
    const product = products.find((p) => p.id === id);
    updateLine(i, {
      product_service_id: id,
      ...(product?.price_ex_vat != null ? { price_ex_vat: product.price_ex_vat } : {}),
      ...(product?.vat_perc != null ? { vat_perc: product.vat_perc } : {}),
    });
  }

  const net = lines.reduce((s, l) => s + l.quantity * l.price_ex_vat * (1 - l.discount_perc), 0);
  const vat = lines.reduce((s, l) => s + l.quantity * l.price_ex_vat * (1 - l.discount_perc) * l.vat_perc, 0);

  return (
    <form
      action={(fd) => {
        if (!confirmClosedYearWrite(String(fd.get("date") || ""), closedThroughYear)) return;
        formAction(fd);
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="lines_json" value={JSON.stringify(lines)} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Invoice #">
          <input name="invoice_number" defaultValue={initial?.invoice_number} required className="input" />
        </Field>
        <Field label="Date">
          <input type="date" name="date" defaultValue={initial?.date} required className="input" />
        </Field>
        <Field label="Type">
          <select name="doc_type" defaultValue={initial?.doc_type ?? "Invoice"} className="input">
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Client">
          <select name="customer_id" defaultValue={initial?.customer_id ?? ""} required className="input">
            <option value="" disabled>
              Select client
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference">
          <input name="reference" defaultValue={initial?.reference ?? ""} className="input" />
        </Field>
        <Field label="Sales ID">
          <input name="sales_id" defaultValue={initial?.sales_id ?? ""} className="input" />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[60rem] table-fixed text-sm">
          <colgroup>
            <col style={{ width: "12rem" }} />
            <col />
            <col style={{ width: "4.5rem" }} />
            <col style={{ width: "6.5rem" }} />
            <col style={{ width: "4.5rem" }} />
            <col style={{ width: "4.5rem" }} />
            <col style={{ width: "16rem" }} />
            <col style={{ width: "6rem" }} />
            <col style={{ width: "5rem" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-2 py-2">Product/Service</th>
              <th className="px-2 py-2">Subject</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">Price ex. VAT</th>
              <th className="px-2 py-2">VAT %</th>
              <th className="px-2 py-2">Disc. %</th>
              <th className="px-2 py-2">Account</th>
              <th className="px-2 py-2">Project</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="p-1">
                  <select
                    className="input"
                    value={l.product_service_id ?? ""}
                    onChange={(e) => onProductChange(i, e.target.value)}
                  >
                    <option value="">&mdash;</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <input className="input" value={l.subject ?? ""} onChange={(e) => updateLine(i, { subject: e.target.value })} />
                </td>
                <td className="p-1 w-20">
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={l.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td className="p-1 w-28">
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={l.price_ex_vat}
                    onChange={(e) => updateLine(i, { price_ex_vat: Number(e.target.value) })}
                  />
                </td>
                <td className="p-1 w-20">
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={l.vat_perc}
                    onChange={(e) => updateLine(i, { vat_perc: Number(e.target.value) })}
                  />
                </td>
                <td className="p-1 w-20">
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={l.discount_perc}
                    onChange={(e) => updateLine(i, { discount_perc: Number(e.target.value) })}
                  />
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
          Net: <span className="font-semibold text-foreground">{net.toFixed(2)}</span> &middot; VAT:{" "}
          <span className="font-semibold text-foreground">{vat.toFixed(2)}</span> &middot; Gross:{" "}
          <span className="font-semibold text-foreground">{(net + vat).toFixed(2)}</span>
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
