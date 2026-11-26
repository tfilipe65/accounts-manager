"use server";

// Payroll entries. One entry per employee per month posts five journal lines together (they share an
// entry_id and name the employee):
//
//   Dr  Wages (direct or office, by the employee's cost type)        gross
//   Dr  Employer social security (direct or office)                  employer share
//       Cr  Salaries payable                                         net pay
//       Cr  Withheld income tax payable (IRS)                        IRS withheld
//       Cr  Social security payable                                  employee + employer share
//
// Wages and social security therefore reach the profit and loss when the work is done, and what is
// owed to the staff and the State sits on the balance sheet until it is paid. Paying is a bank entry:
// net pay to "Salaries payable" (naming the employee), and the State with a split payment to withheld
// tax and social security. Optionally the net pay can be paid from a bank account in the same step.

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { withOverdraftGuard } from "@/lib/overdraft";
import { assertYearOpen } from "@/lib/year-close";
import { requireAccountByRole } from "@/lib/roles";
import { computePayroll } from "@/lib/payroll";

export type PayrollInput = {
  employee_id: number;
  date: string;
  gross: number;
  /** What the gross is made of, e.g. salary plus holiday and Christmas duodecimos (shown in the entry). */
  gross_detail?: string | null;
  irs_perc: number;
  employee_ss_perc: number;
  employer_ss_perc: number;
  /** Pay the net amount from this bank account now (null: leave it owing). */
  pay_from_bank_account_id: number | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function postPayroll(input: PayrollInput): Promise<void> {
  const session = await requireSession();
  if (!input.date) throw new Error("Enter the date of the payroll.");
  if (!(input.gross > 0)) throw new Error("Enter the gross pay.");
  for (const p of [input.irs_perc, input.employee_ss_perc, input.employer_ss_perc]) {
    if (!(p >= 0 && p < 1)) throw new Error("Rates are entered as percentages between 0 and 99.");
  }
  await assertYearOpen(input.date, session);

  await withOverdraftGuard([input.pay_from_bank_account_id], async (tx) => {
    const emp = (await tx.query<{ name: string; cost_type: "direct" | "office" }>("SELECT name, cost_type FROM employees WHERE id = $1", [input.employee_id])).rows[0];
    if (!emp) throw new Error("That employee no longer exists.");
    const direct = emp.cost_type === "direct";
    const wages = await requireAccountByRole(direct ? "wages_direct" : "wages_office", direct ? "Wages: site and workshop staff" : "Wages: office staff", tx);
    const employer = await requireAccountByRole(
      direct ? "employer_social_security_direct" : "employer_social_security_office",
      direct ? "Employer social security: direct staff" : "Employer social security: office staff",
      tx
    );
    const netPay = await requireAccountByRole("net_pay_payable", "Salaries payable", tx);
    const withholding = await requireAccountByRole("withholding_payable", "Withheld income tax payable", tx);
    const ss = await requireAccountByRole("social_security_payable", "Social security payable", tx);

    const f = computePayroll(input.gross, input.irs_perc, input.employee_ss_perc, input.employer_ss_perc);
    const entryId = crypto.randomUUID();
    const label = `${MONTHS[Number(input.date.slice(5, 7)) - 1]} ${input.date.slice(0, 4)}`;
    const line = (account: number, description: string, debit: number, credit: number) =>
      tx.query(
        `INSERT INTO journal_entries (date, account_no, description, debit, credit, employee_id, entry_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [input.date, account, `Payroll ${label}: ${emp.name} - ${description}`, debit, credit, input.employee_id, entryId]
      );
    await line(wages, input.gross_detail ? `gross pay (${input.gross_detail})` : "gross pay", f.gross, 0);
    await line(employer, "employer social security", f.employerSs, 0);
    await line(netPay, "net pay", 0, f.net);
    await line(withholding, "IRS withheld", 0, f.irs);
    await line(ss, "social security (employee and employer share)", 0, f.totalSs);

    if (input.pay_from_bank_account_id != null) {
      await tx.query(
        `INSERT INTO bank_transactions (bank_account_id, payment_date, description, account_no, employee_id, out_amount)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [input.pay_from_bank_account_id, input.date, `Net pay ${label}: ${emp.name}`, netPay, input.employee_id, f.net]
      );
    }
  });
  revalidatePath("/employees");
  revalidatePath("/banking");
}

export type PayrollRun = {
  entry_id: string;
  date: string;
  gross: number;
  employer_ss: number;
  net: number;
  irs: number;
  social_security: number;
};

export async function listPayrollRuns(employeeId: number): Promise<PayrollRun[]> {
  await requireSession();
  const rows = await query<{ entry_id: string; date: string; gross: string; employer_ss: string; net: string; irs: string; ss: string }>(
    `SELECT je.entry_id, MIN(je.date) AS date,
            COALESCE(SUM(je.debit) FILTER (WHERE a.role IN ('wages_direct', 'wages_office')), 0) AS gross,
            COALESCE(SUM(je.debit) FILTER (WHERE a.role IN ('employer_social_security_direct', 'employer_social_security_office')), 0) AS employer_ss,
            COALESCE(SUM(je.credit) FILTER (WHERE a.role = 'net_pay_payable'), 0) AS net,
            COALESCE(SUM(je.credit) FILTER (WHERE a.role = 'withholding_payable'), 0) AS irs,
            COALESCE(SUM(je.credit) FILTER (WHERE a.role = 'social_security_payable'), 0) AS ss
     FROM journal_entries je JOIN accounts a ON a.account_no = je.account_no
     WHERE je.employee_id = $1 AND je.entry_id IS NOT NULL
     GROUP BY je.entry_id ORDER BY MIN(je.date) DESC, je.entry_id`,
    [employeeId]
  );
  return rows.map((r) => ({
    entry_id: r.entry_id,
    date: r.date,
    gross: Number(r.gross),
    employer_ss: Number(r.employer_ss),
    net: Number(r.net),
    irs: Number(r.irs),
    social_security: Number(r.ss),
  }));
}

export async function deletePayrollRun(entryId: string): Promise<void> {
  const session = await requireSession();
  const row = await queryOne<{ date: string }>("SELECT MIN(date) AS date FROM journal_entries WHERE entry_id = $1", [entryId]);
  if (!row?.date) return;
  await assertYearOpen(row.date, session);
  await query("DELETE FROM journal_entries WHERE entry_id = $1", [entryId]);
  revalidatePath("/employees");
}
