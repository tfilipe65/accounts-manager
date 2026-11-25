"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { setReportingYearAction } from "@/lib/reporting-year";

export default function ReportingYearSelector({
  years,
  effectiveYear,
  closedThroughYear,
}: {
  years: number[];
  effectiveYear: number;
  closedThroughYear: number | null;
}) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Reporting year</label>
      <select
        value={effectiveYear}
        disabled={pending}
        onChange={(e) => {
          const year = Number(e.target.value);
          startTransition(() => {
            setReportingYearAction(year, pathname);
          });
        }}
        className="rounded-md border border-white/25 bg-primary px-2 py-1 text-sm text-white disabled:opacity-60"
      >
        {years.map((y) => (
          // The open list takes its own colours, not the dark select's: white with dark text so every year can be read.
          <option key={y} value={y} className="bg-white text-neutral-900">
            {y}
            {closedThroughYear != null && y <= closedThroughYear ? " (closed)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
