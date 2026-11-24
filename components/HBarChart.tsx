// Horizontal bars for a ranked list (operating costs by type, top clients ...). Each row is a label,
// a thin bar scaled to the largest value, and the value; an optional share-of-total is shown beside it.

export type HBarItem = { label: string; value: number; share?: number | null };

export default function HBarChart({ items, color = "#2a78d6", money = true }: { items: HBarItem[]; color?: string; money?: boolean }) {
  const max = Math.max(0, ...items.map((i) => i.value)) || 1;
  const fmt = (n: number) =>
    money
      ? n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  if (items.length === 0) return <p className="py-6 text-center text-sm text-neutral-500">Nothing to show yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <li key={i.label} className="flex flex-col gap-0.5 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-neutral-700" title={i.label}>
              {i.label}
            </span>
            <span className="whitespace-nowrap font-semibold text-foreground">
              {fmt(i.value)}
              {i.share != null && <span className="ml-2 font-normal text-neutral-500">{(i.share * 100).toFixed(1)}%</span>}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-background">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(1, (Math.max(0, i.value) / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
