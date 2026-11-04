"use client";

// Small dependency-free bar chart (grouped or single-series, optionally
// signed/good-bad colored) following the house dataviz method: <=24px thin
// bars with a 4px rounded data-end, a 2px surface gap between bars, hairline
// recessive gridlines, a legend for 2+ series (none for one), and a
// per-bar hover tooltip (values lead, series name follows).

import { useState } from "react";

export type BarChartSeries = { key: string; label: string; color: string };

export default function BarChart({
  categories,
  series,
  data,
  height = 160,
  money = false,
  signed = false,
}: {
  categories: string[];
  series: BarChartSeries[];
  data: Record<string, number>[];
  height?: number;
  /** Format values as money (matches lib/formatters.ts's formatMoney) instead of a compact plain number.
   * A function prop here would have to cross the Server->Client Component boundary as an unserializable
   * closure -- this component is rendered straight from a server page, so it takes a flag instead. */
  money?: boolean;
  /** Single-series only: color each bar by sign (debit-green positive / credit-red negative) instead of a fixed series color. */
  signed?: boolean;
}) {
  const [hover, setHover] = useState<{ cat: number; series: number } | null>(null);

  const formatValue = (n: number) =>
    money
      ? n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString("en-GB", { maximumFractionDigits: 0 });

  const allValues = data.flatMap((row) => series.map((s) => row[s.key] ?? 0));
  const maxVal = Math.max(0, ...allValues);
  const minVal = Math.min(0, ...allValues);
  const range = maxVal - minVal || 1;

  const width = 640;
  const padding = { top: 12, right: 12, bottom: 24, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const zeroY = padding.top + (maxVal / range) * plotH;

  const groupW = plotW / categories.length;
  const barGap = 2;
  const barW = Math.min(24, (groupW - barGap * (series.length + 1)) / series.length);

  // Y-axis: 0 plus max and min (rounded), enough for a reader to gauge scale without clutter.
  const yTicks = Array.from(new Set([0, maxVal, minVal])).filter((v) => Number.isFinite(v));

  function yFor(v: number) {
    return padding.top + ((maxVal - v) / range) * plotH;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={padding.left - 6} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#898781">
              {formatValue(v)}
            </text>
          </g>
        ))}

        {categories.map((cat, ci) => {
          const groupX = padding.left + ci * groupW;
          return (
            <g key={cat}>
              <text x={groupX + groupW / 2} y={height - 6} textAnchor="middle" fontSize={9} fill="#898781">
                {cat}
              </text>
              {series.map((s, si) => {
                const val = data[ci]?.[s.key] ?? 0;
                const barX = groupX + barGap + si * (barW + barGap);
                const barTop = val >= 0 ? yFor(val) : zeroY;
                const barH = Math.max(1, Math.abs(yFor(val) - zeroY));
                const color = signed ? (val >= 0 ? "var(--debit)" : "var(--credit)") : s.color;
                const isHover = hover?.cat === ci && hover?.series === si;
                return (
                  <rect
                    key={s.key}
                    x={barX}
                    y={barTop}
                    width={barW}
                    height={barH}
                    rx={4}
                    fill={color}
                    opacity={isHover ? 1 : 0.85}
                    onMouseEnter={() => setHover({ cat: ci, series: si })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </g>
          );
        })}

        <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} stroke="var(--line)" strokeWidth={1} />
      </svg>

      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-md">
          <div className="font-medium text-foreground">{categories[hover.cat]}</div>
          {series.map((s, si) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3" style={{ background: signed ? undefined : s.color }} />
              <span className="text-neutral-600">{s.label}:</span>
              <span className="font-semibold">{formatValue(data[hover.cat]?.[s.key] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}

      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-4 text-xs text-neutral-600">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
