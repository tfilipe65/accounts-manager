"use client";

// An account picker you can type into: the list narrows as you type ("bank", "4102", "ren veh") and Enter takes the
// first match. It replaces the plain <select> for every account field. Works controlled (value/onChange) or as a plain
// form field (name/defaultValue, submitted through a hidden input). The list is drawn on top of the page (a portal),
// so it is never clipped by a scrolling table.

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Opt = { account_no: number; name: string };

type Props = {
  accounts: Opt[];
  /** Controlled use: the chosen account number, or "" / 0 / null for none. */
  value?: number | string | null;
  onChange?: (accountNo: number | "") => void;
  /** Plain form use. */
  name?: string;
  defaultValue?: number | string | null;
  required?: boolean;
  placeholder?: string;
  /** Text of an extra first choice meaning "no account" (e.g. "None"). */
  blankLabel?: string;
  className?: string;
};

// The first digit of an account number is its group (1 Income ... 9 Financing and tax). Each group has a colour, so a
// glance at the list tells an income account from a cost, an asset or a liability.
const GROUPS: Record<number, { label: string; rgb: string }> = {
  1: { label: "Income", rgb: "37, 99, 235" }, // blue
  2: { label: "Cost of sales", rgb: "234, 88, 12" }, // orange
  3: { label: "Expenses", rgb: "249, 115, 22" }, // orange
  4: { label: "Current assets", rgb: "22, 163, 74" }, // green
  5: { label: "Fixed assets", rgb: "13, 148, 136" }, // teal
  6: { label: "Liabilities", rgb: "202, 138, 4" }, // amber
  7: { label: "Loans", rgb: "161, 98, 7" }, // dark amber
  8: { label: "Equity", rgb: "147, 51, 234" }, // purple
  9: { label: "Financing & tax", rgb: "219, 39, 119" }, // pink
};
const groupOf = (no: number) => GROUPS[Math.floor(no / 1000)];

const fold =(s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const labelOf = (a: Opt) => `${a.account_no} ${a.name}`;

export default function AccountSelect({
  accounts,
  value,
  onChange,
  name,
  defaultValue,
  required,
  placeholder = "Select account",
  blankLabel,
  className = "input",
}: Props) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState<number | "">(() => {
    const d = Number(defaultValue);
    return d ? d : "";
  });
  const current: number | "" = controlled ? (Number(value) ? Number(value) : "") : inner;
  const selected = accounts.find((a) => a.account_no === current);
  // An account that is not in the list any more (an old invoice) still shows its number.
  const selectedText = selected ? labelOf(selected) : current ? String(current) : "";

  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null); // null = show the chosen account, string = being typed
  const [hot, setHot] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const words = fold(text ?? "").split(/\s+/).filter(Boolean);
    const found = words.length === 0 ? accounts : accounts.filter((a) => {
      const hay = fold(labelOf(a));
      return words.every((w) => hay.includes(w));
    });
    // Numbers that start with what was typed come first.
    const first = fold((text ?? "").trim());
    return words.length === 0 || !/^\d/.test(first)
      ? found
      : [...found.filter((a) => String(a.account_no).startsWith(first)), ...found.filter((a) => !String(a.account_no).startsWith(first))];
  }, [accounts, text]);

  const rows: (Opt | null)[] = useMemo(() => (blankLabel && (text ?? "") === "" ? [null, ...matches] : matches), [blankLabel, matches, text]);

  // Place the list under the field (above it when there is no room below).
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const room = window.innerHeight - r.bottom;
      setBox({ left: r.left, top: r.bottom, width: Math.max(r.width, 280), up: room < 220 && r.top > room });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-hot="true"]')?.scrollIntoView({ block: "nearest" });
  }, [hot, open, rows.length]);

  // Required: the form refuses to submit until an account is chosen.
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !current ? "Select an account from the list" : "");
  }, [required, current]);

  function choose(a: Opt | null) {
    const next: number | "" = a ? a.account_no : "";
    if (!controlled) setInner(next);
    onChange?.(next);
    setText(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHot((h) => Math.min(rows.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHot((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault(); // never submits the form while the list is open
        if (rows.length > 0) choose(rows[Math.min(hot, rows.length - 1)]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation(); // closes the list only, not a window it sits in
        setText(null);
        setOpen(false);
      }
    }
  }

  const shown = text ?? (selected || current ? selectedText : "");

  return (
    <>
      {name && <input type="hidden" name={name} value={current === "" ? "" : String(current)} />}
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        className={className}
        style={selected && groupOf(selected.account_no) ? { borderLeft: `4px solid rgb(${groupOf(selected.account_no).rgb})` } : undefined}
        placeholder={blankLabel && !current ? blankLabel : placeholder}
        value={shown}
        title={selectedText}
        onFocus={(e) => {
          e.currentTarget.select();
          setHot(0);
          setOpen(true);
        }}
        onChange={(e) => {
          setText(e.target.value);
          setHot(0);
          setOpen(true);
        }}
        onBlur={() => {
          // Leaving the field: if what was typed is exactly one account's number, take it; otherwise keep the old choice.
          const t = (text ?? "").trim();
          if (text !== null && t) {
            const exact = accounts.filter((a) => String(a.account_no) === t);
            if (exact.length === 1 && exact[0].account_no !== current) choose(exact[0]);
          }
          setText(null);
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      {open &&
        box &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            // mousedown (not click) so the field does not lose focus before the choice registers
            onMouseDown={(e) => e.preventDefault()}
            style={{
              position: "fixed",
              left: box.left,
              width: box.width,
              ...(box.up ? { bottom: window.innerHeight - inputRef.current!.getBoundingClientRect().top } : { top: box.top }),
              maxHeight: "16rem",
              zIndex: 1000,
            }}
            className="overflow-auto rounded-md border border-line bg-surface py-1 text-sm shadow-lg"
          >
            {rows.length === 0 && <li className="px-3 py-2 text-neutral-500">No account matches</li>}
            {rows.map((a, i) => (
              <li
                key={a ? a.account_no : "blank"}
                role="option"
                aria-selected={a ? a.account_no === current : current === ""}
                data-hot={i === hot}
                onMouseEnter={() => setHot(i)}
                onClick={() => choose(a)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 border-l-4 px-3 py-1.5 ${a && a.account_no === current ? "font-semibold" : ""}`}
                style={(() => {
                  const g = a ? groupOf(a.account_no) : undefined;
                  return g
                    ? { borderLeftColor: `rgb(${g.rgb})`, backgroundColor: `rgba(${g.rgb}, ${i === hot ? 0.34 : 0.12})` }
                    : { borderLeftColor: "transparent", backgroundColor: i === hot ? "rgba(128,128,128,0.25)" : undefined };
                })()}
              >
                <span>{a ? labelOf(a) : blankLabel}</span>
                {a && groupOf(a.account_no) && (
                  <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: `rgb(${groupOf(a.account_no).rgb})` }}>
                    {groupOf(a.account_no).label}
                  </span>
                )}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}
