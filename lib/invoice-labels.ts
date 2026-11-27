/**
 * "FT 2026/0062 — Name (3,705.32 due)", "(830.00 still due)" when part-paid, "(fully paid)" when settled.
 * A credit note not yet refunded or applied reads "(credit note, 123.00 to refund)".
 */
export function owedLabel(base: string, gross: number, paid: number): string {
  const owed = gross - paid;
  const m = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (gross < 0 && owed <= -0.005) return `${base} (credit note, ${m(-owed)} to refund)`;
  if (owed < 0.005) return `${base} (fully paid)`;
  if (paid >= 0.005) return `${base} (${m(owed)} still due)`;
  return `${base} (${m(owed)} due)`;
}
