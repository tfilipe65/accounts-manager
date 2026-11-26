// Which accounts a sales line or a purchase line may be booked to. A sales line is income, a purchase line is a
// cost (or a fixed asset that was bought): never equity, a loan, a bank account and so on. The same rule feeds the
// dropdowns (reference-actions.ts) and the check when an invoice is saved, so the two can never disagree.
// Subgroups are recognised by their role, never by number.

import type { Queryable } from "@/lib/db";

export type LineKind = "income" | "expense";

export const INCOME_SUBGROUP_ROLES = ["revenue", "other_income", "interest_income"];

export const EXPENSE_SUBGROUP_ROLES = [
  "cost_materials",
  "cost_direct_services",
  "cost_direct_labour",
  "opex_staff",
  "opex_premises",
  "opex_vehicles",
  "opex_admin",
  "opex_taxes",
  "other_expense",
  "interest_expense",
  "fixed_assets", // a van or a machine bought on a supplier invoice
];

/** Single accounts that look like costs but are posted by the app itself (the year-end stock count). */
export const EXPENSE_EXCLUDED_ACCOUNT_ROLES = ["stock_change"];

export const subgroupRolesFor = (kind: LineKind) => (kind === "income" ? INCOME_SUBGROUP_ROLES : EXPENSE_SUBGROUP_ROLES);
export const excludedAccountRolesFor = (kind: LineKind) => (kind === "income" ? [] : EXPENSE_EXCLUDED_ACCOUNT_ROLES);

/**
 * Throws a plain sentence when a line is booked to an account that does not belong on this kind of line.
 * `keep` are the accounts the invoice already carries (editing an old invoice must not fail on what is already there).
 */
export async function assertLineAccounts(client: Queryable, kind: LineKind, accountNos: number[], keep: number[] = []): Promise<void> {
  const check = Array.from(new Set(accountNos.filter((n) => n && !keep.includes(n))));
  if (check.length === 0) return;
  const rows = (
    await client.query<{ account_no: number; name: string }>(
      `SELECT a.account_no, a.name
       FROM accounts a JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
       WHERE a.account_no = ANY($1::int[])
         AND NOT (COALESCE(sg.role, '') = ANY($2::text[]) AND COALESCE(a.role, '') <> ALL($3::text[]))`,
      [check, subgroupRolesFor(kind), excludedAccountRolesFor(kind)]
    )
  ).rows;
  if (rows.length === 0) return;
  const bad = rows.map((r) => `${r.account_no} ${r.name}`).join(", ");
  throw new Error(
    kind === "income"
      ? `A sales line must go to an income account. Not allowed: ${bad}.`
      : `A purchase line must go to a cost account (or a fixed asset). Not allowed: ${bad}.`
  );
}
