// Plain CSV for the "export" links on the reports. Semicolon-separated with a UTF-8 BOM, which is what
// Excel in a Portuguese or English locale opens correctly (commas would clash with decimal commas).

export type CsvCell = string | number | null | undefined;

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const cell = (v: CsvCell) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(v) : v;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]+/g, "_")}"`,
    },
  });
}
