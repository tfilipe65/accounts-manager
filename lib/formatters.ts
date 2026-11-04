// `new Date("2026-09-05").toLocaleDateString()` parses the string as UTC
// midnight, then renders it in the browser's local timezone -- anywhere
// behind UTC that silently shows the previous day. Postgres DATE columns
// (and this app's inputs) are plain YYYY-MM-DD with no time component, so
// format them as text directly instead of round-tripping through Date.
export function formatDate(iso: string | Date): string {
  const s = iso instanceof Date ? iso.toISOString() : iso;
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatMoney(n: number): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
