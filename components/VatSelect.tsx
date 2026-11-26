"use client";

// One VAT % dropdown for every form: 0% and the company's own rates (Settings). A value that is not one of them
// (older data) stays selectable, so nothing is changed behind anyone's back.

import { useEffect, useState } from "react";
import { getVatRates } from "@/lib/actions/vat-rate-actions";

const FALLBACK = [0.23, 0.13, 0.06];
let cache: { at: number; promise: Promise<number[]> } | null = null;
function loadRates(): Promise<number[]> {
  // One request serves all the rows of a form; refreshed after a few seconds so a change in Settings shows up.
  if (!cache || Date.now() - cache.at > 5000) cache = { at: Date.now(), promise: getVatRates().catch(() => FALLBACK) };
  return cache.promise;
}

const label = (v: number) => `${Math.round(v * 10000) / 100}%`;
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

type Props = {
  /** Controlled use (invoice lines). */
  value?: number | null;
  onChange?: (value: number) => void;
  /** Plain form use. */
  name?: string;
  defaultValue?: number | null;
  /** Offer an empty choice (for fields where VAT is optional). */
  allowBlank?: boolean;
  className?: string;
};

export default function VatSelect({ value, onChange, name, defaultValue, allowBlank, className = "input" }: Props) {
  const [rates, setRates] = useState<number[]>(FALLBACK);
  useEffect(() => {
    let live = true;
    loadRates().then((r) => live && r.length > 0 && setRates(r));
    return () => {
      live = false;
    };
  }, []);

  const current = value !== undefined ? value : defaultValue;
  const options = Array.from(new Set([0, ...rates].map((v) => Math.round(v * 1e6) / 1e6))).sort((a, b) => b - a);
  if (current != null && !options.some((o) => same(o, current))) options.push(current);

  const common = { name, className };
  const body = (
    <>
      {allowBlank && <option value="">&mdash;</option>}
      {options.map((o) => (
        <option key={o} value={String(o)}>
          {label(o)}
        </option>
      ))}
    </>
  );

  if (value !== undefined) {
    return (
      <select {...common} value={value == null ? "" : String(value)} onChange={(e) => onChange?.(Number(e.target.value))}>
        {body}
      </select>
    );
  }
  return (
    <select {...common} defaultValue={defaultValue == null ? "" : String(defaultValue)}>
      {body}
    </select>
  );
}
