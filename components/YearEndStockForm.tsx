"use client";

import { useActionState, useState } from "react";
import { postYearEndStockFormAction } from "@/lib/actions/stock-form-actions";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import { formatMoney as fmt } from "@/lib/formatters";

type FormState = { error?: string; success?: boolean } | undefined;

/** Post the stock counted at the end of a year; shows the adjustment before it is saved. */
export default function YearEndStockForm({
  years,
  defaultYear,
  baselineByYear,
  closedThroughYear,
}: {
  years: number[];
  defaultYear: number;
  baselineByYear: Record<number, number>;
  closedThroughYear: number | null;
}) {
  const [state, action, pending] = useActionState(postYearEndStockFormAction, undefined as FormState);
  const [year, setYear] = useState(defaultYear);
  const [value, setValue] = useState("");
  const base = baselineByYear[year] ?? 0;
  const counted = value === "" ? null : Number(value.replace(",", "."));
  const adjustment = counted != null && Number.isFinite(counted) ? Math.round((counted - base) * 100) / 100 : null;

  return (
    <form
      action={(fd) => {
        if (!confirmClosedYearWrite(`${fd.get("year")}-12-31`, closedThroughYear)) return;
        action(fd);
      }}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Year of the count</label>
          <select name="year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="input">
            {years.map((y) => (
              <option key={y} value={y}>
                31 Dec {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Value of the stock counted</label>
          <input name="value" type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" required className="input" />
        </div>
        <div className="flex flex-col gap-1 text-sm md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">What will be posted</span>
          {adjustment == null ? (
            <span className="text-neutral-500">Enter the value counted. The stock account shows {fmt(base)} at the end of {year} before this count.</span>
          ) : Math.abs(adjustment) < 0.005 ? (
            <span className="text-neutral-500">Nothing: the stock account already shows this value.</span>
          ) : (
            <span>
              {adjustment > 0 ? "Stock goes up" : "Stock goes down"} by <strong className="text-primary">{fmt(Math.abs(adjustment))}</strong> on 31 Dec {year}
              {adjustment > 0 ? ", and cost of sales drops by the same amount" : ", and cost of sales rises by the same amount"}. Reversed on 1 Jan {year + 1}.
            </span>
          )}
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Stock count posted.</p>}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
          {pending ? "Posting…" : "Post stock count"}
        </button>
        <span className="text-xs text-neutral-500">Counting a year again replaces the earlier count for that year.</span>
      </div>
    </form>
  );
}
