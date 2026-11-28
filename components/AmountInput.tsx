"use client";

import { useEffect, useState } from "react";

/**
 * A number cell for table rows whose value lives in a number field: it shows empty while the value is 0 (no
 * leftover "0" to type next to or leave by mistake), yet lets you type "0.5" without losing the leading zero.
 */
export default function AmountInput({
  value,
  onChange,
  step = "any",
  className = "input",
}: {
  value: number;
  onChange: (n: number) => void;
  step?: string;
  className?: string;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  // follow changes made from outside (a product picked fills its price)
  useEffect(() => {
    setText((t) => (Number(t || 0) === value ? t : value ? String(value) : ""));
  }, [value]);
  return (
    <input
      type="number"
      step={step}
      className={className}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(Number(e.target.value) || 0);
      }}
    />
  );
}
