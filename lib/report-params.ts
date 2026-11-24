// Reads the report filters out of a page or export URL, with the reporting year as the default period.

import type { GroupBy, ReportKind, ReportParams, StatusFilter } from "@/lib/actions/report-actions";

export type ReportQuery = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const int = (v: string): number | null => (v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export type ReportView = "income" | "expense" | "bank";

export function parseReportQuery(q: ReportQuery, year: number): { view: ReportView; params: ReportParams; bankAccountId: number | null } {
  const type = one(q.type);
  const view: ReportView = type === "expense" || type === "bank" ? type : "income";
  const from = isDate(one(q.from)) ? one(q.from) : `${year}-01-01`;
  const to = isDate(one(q.to)) ? one(q.to) : `${year}-12-31`;
  const status = (["paid", "outstanding"].includes(one(q.status)) ? one(q.status) : "all") as StatusFilter;
  const groupBy = (["account", "project", "month"].includes(one(q.group)) ? one(q.group) : "party") as GroupBy;
  const kind: ReportKind = view === "expense" ? "expense" : "income";
  return {
    view,
    params: { kind, from, to, partyId: int(one(q.party)), projectId: int(one(q.project)), accountNo: int(one(q.account)), status, groupBy },
    bankAccountId: int(one(q.bank)),
  };
}
