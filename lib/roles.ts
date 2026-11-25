// Roles: the app finds the accounts it needs by what they are for, never by number, so a chart of
// accounts can be numbered however suits the business (see db/migrations/*_roles_and_splits.sql).
//   subgroup roles  revenue, other_income, interest_income, cost_*, opex_*, other_expense, interest_expense,
//                   income_tax, cash, receivables, inventory ...
//   account roles   transfers_clearing, vat_input, vat_output, vat_settlement, accounts_receivable,
//                   accounts_payable, wages_direct, wages_office, net_pay_payable, withholding_payable,
//                   social_security_payable ...
import { query, queryOne, type Queryable } from "@/lib/db";

/** The account (lowest number) that has this role, or null when the chart has none. */
export async function accountNoByRole(role: string, tx?: Queryable): Promise<number | null> {
  const sql = "SELECT account_no FROM accounts WHERE role = $1 ORDER BY account_no LIMIT 1";
  if (tx) return (await tx.query<{ account_no: number }>(sql, [role])).rows[0]?.account_no ?? null;
  return (await queryOne<{ account_no: number }>(sql, [role]))?.account_no ?? null;
}

/** Like accountNoByRole but explains what is missing, for the places that cannot go on without it. */
export async function requireAccountByRole(role: string, whatItIs: string, tx?: Queryable): Promise<number> {
  const no = await accountNoByRole(role, tx);
  if (no == null) throw new Error(`The chart of accounts has no "${whatItIs}" account. Add one and give it the role "${role}".`);
  return no;
}

/** Every account number that has one of these roles. */
export async function accountNosByRoles(roles: string[]): Promise<number[]> {
  const rows = await query<{ account_no: number }>("SELECT account_no FROM accounts WHERE role = ANY($1::text[]) ORDER BY account_no", [roles]);
  return rows.map((r) => r.account_no);
}

/** The subgroup that holds cash and bank accounts. */
export async function cashSubgroupNo(tx?: Queryable): Promise<number> {
  const sql = "SELECT subgroup_no FROM account_subgroups WHERE role = 'cash' ORDER BY subgroup_no LIMIT 1";
  const row = tx ? (await tx.query<{ subgroup_no: number }>(sql)).rows[0] : await queryOne<{ subgroup_no: number }>(sql);
  if (!row) throw new Error('The chart of accounts has no subgroup with the role "cash".');
  return row.subgroup_no;
}
