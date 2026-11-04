"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type AppSettings = {
  company_name: string;
  vat_number: string | null;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  date_format: string;
  fiscal_year_start_month: number;
  reporting_year: number;
  vat_rate_1: number;
  vat_rate_2: number;
  vat_rate_3: number;
  vat_rate_4: number | null;
};

export async function getAppSettings(): Promise<AppSettings> {
  await requireAdmin();
  const row = await queryOne<AppSettings>(`
    SELECT company_name, vat_number, bank_name, iban, bic, telephone, email, website,
           currency, date_format, fiscal_year_start_month, reporting_year,
           vat_rate_1, vat_rate_2, vat_rate_3, vat_rate_4
    FROM app_settings WHERE id = 1
  `);
  if (!row) throw new Error("Settings row missing.");
  return {
    ...row,
    fiscal_year_start_month: Number(row.fiscal_year_start_month),
    reporting_year: Number(row.reporting_year),
    vat_rate_1: Number(row.vat_rate_1),
    vat_rate_2: Number(row.vat_rate_2),
    vat_rate_3: Number(row.vat_rate_3),
    vat_rate_4: row.vat_rate_4 != null ? Number(row.vat_rate_4) : null,
  };
}

export async function updateAppSettings(input: AppSettings): Promise<void> {
  await requireAdmin();
  await query(
    `UPDATE app_settings SET
       company_name = $1, vat_number = $2, bank_name = $3, iban = $4, bic = $5,
       telephone = $6, email = $7, website = $8, currency = $9, date_format = $10,
       fiscal_year_start_month = $11, reporting_year = $12,
       vat_rate_1 = $13, vat_rate_2 = $14, vat_rate_3 = $15, vat_rate_4 = $16
     WHERE id = 1`,
    [
      input.company_name,
      input.vat_number,
      input.bank_name,
      input.iban,
      input.bic,
      input.telephone,
      input.email,
      input.website,
      input.currency,
      input.date_format,
      input.fiscal_year_start_month,
      input.reporting_year,
      input.vat_rate_1,
      input.vat_rate_2,
      input.vat_rate_3,
      input.vat_rate_4,
    ]
  );
  revalidatePath("/settings");
}

export async function getClosedThroughYear(): Promise<number | null> {
  await requireAdmin();
  const row = await queryOne<{ closed_through_year: number | null }>("SELECT closed_through_year FROM app_settings WHERE id = 1");
  return row?.closed_through_year ?? null;
}

// Sequential only -- closes exactly the next year after whatever's already
// closed (or the company's reporting_year, if nothing is closed yet). A
// year-picker here would let someone close 2025 while 2023 is still open,
// which real bookkeeping practice never does -- one unambiguous button
// instead avoids that entirely.
export async function closeYear(): Promise<number> {
  await requireAdmin();
  const settings = await queryOne<{ closed_through_year: number | null; reporting_year: number }>(
    "SELECT closed_through_year, reporting_year FROM app_settings WHERE id = 1"
  );
  const yearToClose = settings?.closed_through_year != null ? settings.closed_through_year + 1 : (settings?.reporting_year ?? new Date().getFullYear());
  await query("UPDATE app_settings SET closed_through_year = $1 WHERE id = 1", [yearToClose]);
  revalidatePath("/settings");
  return yearToClose;
}

// Only a single cursor is tracked (not a history of individual closes), so
// reopening clears it entirely rather than guessing which one year to peel
// back -- simplest safe behaviour, and matches closeYear()'s own "one
// unambiguous button" philosophy. Re-closing walks forward year by year
// again from wherever reporting_year is.
export async function reopenYear(): Promise<void> {
  await requireAdmin();
  await query("UPDATE app_settings SET closed_through_year = NULL WHERE id = 1");
  revalidatePath("/settings");
}

export type UserRow = { id: number; username: string; name: string; role: "ADMIN" | "USER" };

export async function listUsers(): Promise<UserRow[]> {
  await requireAdmin();
  return query<UserRow>("SELECT id, username, name, role FROM users ORDER BY id");
}

export async function createUser(input: { username: string; name: string; password: string; role: "ADMIN" | "USER" }): Promise<void> {
  await requireAdmin();
  const hash = bcrypt.hashSync(input.password, 10);
  await query("INSERT INTO users (username, password_hash, name, role) VALUES ($1,$2,$3,$4)", [input.username, hash, input.name, input.role]);
  revalidatePath("/settings");
}

export async function deleteUser(id: number): Promise<void> {
  const admin = await requireAdmin();
  if (admin.id === id) throw new Error("You can't delete your own account while logged in as it.");
  await query("DELETE FROM users WHERE id = $1", [id]);
  revalidatePath("/settings");
}
