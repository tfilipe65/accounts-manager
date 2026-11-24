import { formatMoney as fmt } from "@/lib/formatters";
import type { StatementRow } from "@/lib/pl-rows";

// One P&L table for any set of periods (quarters or months): a label, the periods, the year total and
// -- when asked -- each line's share of revenue.

export default function StatementTable({
  columns,
  rows,
  revenueTotal,
  showPercent = true,
  compact = false,
}: {
  columns: string[];
  rows: StatementRow[];
  revenueTotal: number;
  showPercent?: boolean;
  compact?: boolean;
}) {
  const cell = (n: number, cost?: boolean) => (cost && Math.abs(n) > 0.004 ? `(${fmt(Math.abs(n))})` : fmt(n));
  const pad = compact ? "px-2 py-1 text-xs" : "px-4 py-2";
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
            <th className={pad} />
            {columns.map((c) => (
              <th key={c} className={`${pad} text-right`}>
                {c}
              </th>
            ))}
            <th className={`${pad} text-right`}>Year</th>
            {showPercent && <th className={`${pad} text-right`}>% of sales</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const bold = r.kind !== "line";
            return (
              <tr key={r.key} className={`${r.kind === "total" ? "border-t-2 border-primary" : ""} ${bold ? "font-semibold" : ""}`}>
                <td className={`${pad} ${r.indent ? "pl-8 font-normal text-neutral-600" : ""} ${r.kind === "total" ? "text-primary" : ""}`}>{r.label}</td>
                {r.cells.map((v, i) => (
                  <td key={i} className={`${pad} text-right ${v < -0.004 && !r.cost ? "text-credit" : ""}`}>
                    {cell(v, r.cost)}
                  </td>
                ))}
                <td className={`${pad} text-right ${r.total < -0.004 && !r.cost ? "text-credit" : ""}`}>{cell(r.total, r.cost)}</td>
                {showPercent && (
                  <td className={`${pad} text-right text-neutral-600`}>{revenueTotal > 0.005 ? `${((r.total / revenueTotal) * 100).toFixed(1)}%` : "—"}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
