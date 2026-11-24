"use server";

// Employees. Master data like clients and suppliers; what an employee was paid is not stored here
// but read from the bank register -- a direct bank entry (wages, a refund of expenses ...) that
// names the employee. So payroll totals always agree with the bank.

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type EmployeeInput = {
  name: string;
  position: string | null;
  vat_number: string | null;
  social_security_number: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  telephone: string | null;
  email: string | null;
  iban: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_salary: number | null;
  status: "Active" | "Inactive";
  notes: string | null;
};

export type Employee = EmployeeInput & { id: number };

export type EmployeeListRow = {
  id: number;
  name: string;
  position: string | null;
  status: "Active" | "Inactive";
  start_date: string | null;
  monthly_salary: number | null;
  paid_year: number;
  paid_total: number;
};

/** @param year Payments counted for "paid this year" (the reporting year). */
export async function listEmployees(year: number): Promise<EmployeeListRow[]> {
  await requireSession();
  const rows = await query<{
    id: number;
    name: string;
    position: string | null;
    status: "Active" | "Inactive";
    start_date: string | null;
    monthly_salary: string | null;
    paid_year: string;
    paid_total: string;
  }>(
    `SELECT e.id, e.name, e.position, e.status, e.start_date, e.monthly_salary,
            COALESCE(p.paid_year, 0) AS paid_year, COALESCE(p.paid_total, 0) AS paid_total
     FROM employees e
     LEFT JOIN (
       SELECT employee_id,
              SUM(out_amount + out_vat - in_amount - in_vat) FILTER (WHERE EXTRACT(YEAR FROM payment_date) = $1) AS paid_year,
              SUM(out_amount + out_vat - in_amount - in_vat) AS paid_total
       FROM bank_transactions WHERE employee_id IS NOT NULL GROUP BY employee_id
     ) p ON p.employee_id = e.id
     ORDER BY (e.status = 'Active') DESC, e.name`,
    [year]
  );
  return rows.map((r) => ({
    ...r,
    monthly_salary: r.monthly_salary != null ? Number(r.monthly_salary) : null,
    paid_year: Number(r.paid_year),
    paid_total: Number(r.paid_total),
  }));
}

export async function getEmployee(id: number): Promise<Employee | null> {
  await requireSession();
  const r = await queryOne<Omit<Employee, "monthly_salary"> & { monthly_salary: string | null }>(
    `SELECT id, name, position, vat_number, social_security_number, address, zip, city, country, telephone, email, iban,
            start_date, end_date, monthly_salary, status, notes
     FROM employees WHERE id = $1`,
    [id]
  );
  return r ? { ...r, monthly_salary: r.monthly_salary != null ? Number(r.monthly_salary) : null } : null;
}

export async function listEmployeeOptions(): Promise<{ id: number; name: string }[]> {
  await requireSession();
  return query<{ id: number; name: string }>("SELECT id, name FROM employees WHERE status = 'Active' ORDER BY name");
}

export type EmployeePayment = {
  id: number;
  payment_date: string;
  description: string | null;
  bank_account: string;
  account: string | null;
  amount: number; // positive = paid to the employee
};

export async function listEmployeePayments(employeeId: number): Promise<EmployeePayment[]> {
  await requireSession();
  const rows = await query<{
    id: number;
    payment_date: string;
    description: string | null;
    bank_account: string;
    account: string | null;
    amount: string;
  }>(
    `SELECT bt.id, bt.payment_date, bt.description, ba.name AS bank_account,
            CASE WHEN a.account_no IS NULL THEN NULL ELSE a.account_no || ' ' || a.name END AS account,
            (bt.out_amount + bt.out_vat - bt.in_amount - bt.in_vat) AS amount
     FROM bank_transactions bt
     JOIN bank_accounts ba ON ba.id = bt.bank_account_id
     LEFT JOIN accounts a ON a.account_no = bt.account_no
     WHERE bt.employee_id = $1
     ORDER BY bt.payment_date DESC, bt.id DESC`,
    [employeeId]
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

const COLUMNS = `name, position, vat_number, social_security_number, address, zip, city, country, telephone, email, iban,
  start_date, end_date, monthly_salary, status, notes`;

function values(input: EmployeeInput): unknown[] {
  return [
    input.name,
    input.position,
    input.vat_number,
    input.social_security_number,
    input.address,
    input.zip,
    input.city,
    input.country,
    input.telephone,
    input.email,
    input.iban,
    input.start_date,
    input.end_date,
    input.monthly_salary,
    input.status,
    input.notes,
  ];
}

export async function createEmployee(input: EmployeeInput): Promise<void> {
  await requireSession();
  await query(`INSERT INTO employees (${COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, values(input));
  revalidatePath("/employees");
}

export async function updateEmployee(id: number, input: EmployeeInput): Promise<void> {
  await requireSession();
  await query(
    `UPDATE employees SET name=$2, position=$3, vat_number=$4, social_security_number=$5, address=$6, zip=$7, city=$8, country=$9,
       telephone=$10, email=$11, iban=$12, start_date=$13, end_date=$14, monthly_salary=$15, status=$16, notes=$17 WHERE id=$1`,
    [id, ...values(input)]
  );
  revalidatePath("/employees");
}

/** An employee who has been paid keeps their history: they can only be set to Inactive, not deleted. */
export async function deleteEmployee(id: number): Promise<void> {
  await requireSession();
  const used = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM bank_transactions WHERE employee_id = $1", [id]);
  if (Number(used?.n ?? 0) > 0) {
    await query("UPDATE employees SET status = 'Inactive' WHERE id = $1", [id]);
  } else {
    await query("DELETE FROM employees WHERE id = $1", [id]);
  }
  revalidatePath("/employees");
}
