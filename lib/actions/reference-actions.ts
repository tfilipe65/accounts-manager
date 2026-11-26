"use server";

// Read-only dropdown/reference data shared by the transaction-entry forms
// (Income, Expense, Banking, Journal Entries). Gated on plain authentication
// only -- there's no per-area permission model in this app (unlike the
// sibling apps), just ADMIN vs USER, and Settings is the only ADMIN-only
// area (see lib/auth.ts's requireAdmin).

import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { excludedAccountRolesFor, subgroupRolesFor, type LineKind } from "@/lib/account-rules";

export type AccountOption = { account_no: number; name: string; normal_balance: "debit" | "credit" };
export type NamedOption = { id: number; name: string };
export type ProjectOption = { id: number; code: string; name: string };
export type ProductOption = { id: number; name: string; unit: string | null; price_ex_vat: number | null; vat_perc: number | null };

// Excludes reserved accounts (AR/AP/Bank1-3/Cash) -- matches the workbook's
// own validation on Income/Expense/Bank direct-entry account fields (its AX
// column flags a reserved account as an error there). Use this for those
// three forms.
export async function listAccountOptions(): Promise<AccountOption[]> {
  await requireSession();
  return query<AccountOption>(`
    SELECT a.account_no, a.name, sg.normal_balance
    FROM accounts a JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
    WHERE a.is_reserved = false ORDER BY a.account_no
  `);
}

// The accounts a sales line (income) or a purchase line (cost, or a fixed asset bought) may use -- see
// lib/account-rules.ts. `alsoInclude` keeps the accounts an invoice being edited already carries.
async function lineAccountOptions(kind: LineKind, alsoInclude: number[]): Promise<AccountOption[]> {
  await requireSession();
  return query<AccountOption>(
    `SELECT a.account_no, a.name, sg.normal_balance
     FROM accounts a JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
     WHERE a.is_reserved = false
       AND ((COALESCE(sg.role, '') = ANY($1::text[]) AND COALESCE(a.role, '') <> ALL($2::text[])) OR a.account_no = ANY($3::int[]))
     ORDER BY a.account_no`,
    [subgroupRolesFor(kind), excludedAccountRolesFor(kind), alsoInclude]
  );
}
export async function listIncomeAccountOptions(alsoInclude: number[] = []): Promise<AccountOption[]> {
  return lineAccountOptions("income", alsoInclude);
}
export async function listExpenseAccountOptions(alsoInclude: number[] = []): Promise<AccountOption[]> {
  return lineAccountOptions("expense", alsoInclude);
}

// Unfiltered -- Journal Entries and Opening Balance legitimately post to
// reserved accounts (that's exactly how an opening AR/AP/bank balance gets
// set), so they use this instead of listAccountOptions().
export async function listAllAccountOptions(): Promise<AccountOption[]> {
  await requireSession();
  return query<AccountOption>(`
    SELECT a.account_no, a.name, sg.normal_balance
    FROM accounts a JOIN account_subgroups sg ON sg.subgroup_no = a.subgroup_no
    ORDER BY a.account_no
  `);
}

export async function listCustomerOptions(): Promise<NamedOption[]> {
  await requireSession();
  return query<NamedOption>("SELECT id, name FROM customers ORDER BY name");
}

export async function listSupplierOptions(): Promise<NamedOption[]> {
  await requireSession();
  return query<NamedOption>("SELECT id, name FROM suppliers ORDER BY name");
}

export async function listProjectOptions(): Promise<ProjectOption[]> {
  await requireSession();
  return query<ProjectOption>("SELECT id, code, name FROM projects ORDER BY code");
}

export async function listProductOptions(): Promise<ProductOption[]> {
  await requireSession();
  const rows = await query<{ id: number; name: string; unit: string | null; price_ex_vat: string | null; vat_perc: string | null }>(
    "SELECT id, name, unit, price_ex_vat, vat_perc FROM products_services ORDER BY name"
  );
  return rows.map((r) => ({
    ...r,
    price_ex_vat: r.price_ex_vat != null ? Number(r.price_ex_vat) : null,
    vat_perc: r.vat_perc != null ? Number(r.vat_perc) : null,
  }));
}
