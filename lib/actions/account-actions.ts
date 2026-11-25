"use server";

// Chart of Accounts CRUD. account_no (not the surrogate id) is what every
// other table's FK actually points at, so Postgres itself blocks unsafe
// changes for free: deleting or renumbering an account that's already
// referenced by an invoice line, journal entry, bank transaction, or
// app_settings' reserved-account pointers fails with a foreign-key error
// rather than silently corrupting those rows -- that error is surfaced
// as-is (see the form actions), not swallowed.
//
// is_reserved is intentionally NOT editable here: it's a system-integrity
// flag that should stay in sync with app_settings' account_no_ar/ap/etc
// pointers (edited on the Settings page), not something to flip
// independently from an account's own edit form.

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireSession, requireAdminForAction } from "@/lib/auth";

export type AccountInput = { account_no: number; name: string; subgroup_no: number };
export type Account = AccountInput & { is_reserved: boolean };

export async function getAccount(accountNo: number): Promise<Account | null> {
  await requireSession();
  return queryOne<Account>("SELECT account_no, name, subgroup_no, is_reserved FROM accounts WHERE account_no = $1", [accountNo]);
}

export async function createAccount(input: AccountInput): Promise<void> {
  await requireAdminForAction();
  await query("INSERT INTO accounts (account_no, name, subgroup_no) VALUES ($1,$2,$3)", [input.account_no, input.name, input.subgroup_no]);
  revalidatePath("/chart-of-accounts");
}

export async function updateAccount(originalAccountNo: number, input: AccountInput): Promise<void> {
  await requireAdminForAction();
  await query("UPDATE accounts SET account_no = $2, name = $3, subgroup_no = $4 WHERE account_no = $1", [
    originalAccountNo,
    input.account_no,
    input.name,
    input.subgroup_no,
  ]);
  revalidatePath("/chart-of-accounts");
}

export async function deleteAccount(accountNo: number): Promise<void> {
  await requireAdminForAction();
  await query("DELETE FROM accounts WHERE account_no = $1", [accountNo]);
  revalidatePath("/chart-of-accounts");
}

export type SubgroupOption = { subgroup_no: number; name: string; group_name: string; /** e.g. "7110-7213": the account numbers it holds, empty when it has none. */ range: string };

export async function listSubgroupOptions(): Promise<SubgroupOption[]> {
  await requireSession();
  return query<SubgroupOption>(`
    SELECT sg.subgroup_no, sg.name, g.name AS group_name,
           COALESCE((SELECT CASE WHEN MIN(a.account_no) = MAX(a.account_no) THEN MIN(a.account_no)::text
                                 ELSE MIN(a.account_no) || '-' || MAX(a.account_no) END
                     FROM accounts a WHERE a.subgroup_no = sg.subgroup_no), '') AS range
    FROM account_subgroups sg JOIN account_groups g ON g.group_no = sg.group_no
    ORDER BY g.group_no, sg.subgroup_no
  `);
}
