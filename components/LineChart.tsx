"use client";

// Small dependency-free line chart (one or more series over the same categories) in the house
// dataviz style: 2px lines, markers of at least 8px diameter on hover only, hairline gridlines, a
// legend for two or more series, and a crosshair tooltip that reads all series at the hovered category.

import { useState } from "react";
import { useChartWidth } from "@/components/useChartWidth";

export type LineChartSeries = { key: string; label: string; color: string; dashed?: boolean };

export default function LineChart({
  categories,
  series,
  data,
  height = 180,
  money = false,
}: {
  categories: string[];
  series: LineChartSeries[];
  data: Record<string, number>[];
  height?: number;
  money?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, width] = useChartWidth();

  const fmt = (n: number) =>
    money
      ? n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  const compact = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k` : n.toLocaleString("en-GB", { maximumFractionDigits: 0 }));

  const values = data.flatMap((row) => series.map((s) => row[s.key] ?? 0));
  const maxVal = Math.max(0, ...values);
  const minVal = Math.min(0, ...values);
  const range = maxVal - minVal || 1;

  const pad = { top: 12, right: 14, bottom: 24, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (categories.length <= 1 ? plotW / 2 : (i / (categories.length - 1)) * plotW);
  const y = (v: number) => pad.top + ((maxVal - v) / range) * plotH;
  const ticks = Array.from(new Set([0, maxVal, minVal, maxVal / 2])).filter((v) => Number.isFinite(v));
  const step = plotW / Math.max(1, categories.length - 1);

  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" role="img" onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#898781">
              {compact(v)}
            </text>
          </g>
        ))}
        {categories.map((c, i) => (
          <text key={c} x={x(i)} y={height - 6} textAnchor="middle" fontSize={9} fill="#898781">
            {c}
          </text>
        ))}

        {series.map((s) => (
          <polyline
            key={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "5 4" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={data.map((row, i) => `${x(i)},${y(row[s.key] ?? 0)}`).join(" ")}
          />
        ))}

        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} stroke="var(--line)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(data[hover]?.[s.key] ?? 0)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </g>
        )}

        {categories.map((c, i) => (
          <rect
            key={c}
            x={x(i) - step / 2}
            y={pad.top}
            width={step}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseMove={() => setHover(i)}
          />
        ))}
      </svg>

      {hover != null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-md">
          <div className="font-medium text-foreground">{categories[hover]}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
              <span className="text-neutral-600">{s.label}:</span>
              <span className="font-semibold">{fmt(data[hover]?.[s.key] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}

      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-4 text-xs text-neutral-600">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
