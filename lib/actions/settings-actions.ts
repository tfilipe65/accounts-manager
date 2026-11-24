"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { SECTIONS } from "@/lib/sections";
import { writeAudit } from "@/lib/audit";
import { passwordProblem } from "@/lib/password-policy";

export type AppSettings = {
  company_name: string;
  vat_number: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
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
  payment_term_days: number;
  vat_rate_1: number;
  vat_rate_2: number;
  vat_rate_3: number;
  vat_rate_4: number | null;
  client_label: string;
  project_label: string;
  account_no_interest_expense: number | null;
};

export async function getAppSettings(): Promise<AppSettings> {
  await requireAdmin();
  const row = await queryOne<AppSettings>(`
    SELECT company_name, vat_number, address, zip, city, country, bank_name, iban, bic, telephone, email, website,
           currency, date_format, fiscal_year_start_month, reporting_year, payment_term_days,
           vat_rate_1, vat_rate_2, vat_rate_3, vat_rate_4, client_label, project_label, account_no_interest_expense
    FROM app_settings WHERE id = 1
  `);
  if (!row) throw new Error("Settings row missing.");
  return {
    ...row,
    fiscal_year_start_month: Number(row.fiscal_year_start_month),
    reporting_year: Number(row.reporting_year),
    payment_term_days: Number(row.payment_term_days),
    vat_rate_1: Number(row.vat_rate_1),
    vat_rate_2: Number(row.vat_rate_2),
    vat_rate_3: Number(row.vat_rate_3),
    vat_rate_4: row.vat_rate_4 != null ? Number(row.vat_rate_4) : null,
    account_no_interest_expense: row.account_no_interest_expense != null ? Number(row.account_no_interest_expense) : null,
  };
}

export async function updateAppSettings(input: AppSettings): Promise<void> {
  const admin = await requireAdmin();
  await query(
    `UPDATE app_settings SET
       company_name = $1, vat_number = $2, bank_name = $3, iban = $4, bic = $5,
       telephone = $6, email = $7, website = $8, currency = $9, date_format = $10,
       fiscal_year_start_month = $11, reporting_year = $12,
       vat_rate_1 = $13, vat_rate_2 = $14, vat_rate_3 = $15, vat_rate_4 = $16,
       address = $17, zip = $18, city = $19, country = $20,
       payment_term_days = $21, client_label = $22, project_label = $23, account_no_interest_expense = $24
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
      input.address,
      input.zip,
      input.city,
      input.country,
      input.payment_term_days,
      input.client_label || "Clients",
      input.project_label || "Projects",
      input.account_no_interest_expense,
    ]
  );
  await writeAudit(admin, "settings.update");
  revalidatePath("/", "layout");
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
  const admin = await requireAdmin();
  const settings = await queryOne<{ closed_through_year: number | null; reporting_year: number }>(
    "SELECT closed_through_year, reporting_year FROM app_settings WHERE id = 1"
  );
  const yearToClose = settings?.closed_through_year != null ? settings.closed_through_year + 1 : (settings?.reporting_year ?? new Date().getFullYear());
  await query("UPDATE app_settings SET closed_through_year = $1 WHERE id = 1", [yearToClose]);
  await writeAudit(admin, "year.close", String(yearToClose));
  revalidatePath("/settings");
  return yearToClose;
}

// Only a single cursor is tracked (not a history of individual closes), so
// reopening clears it entirely rather than guessing which one year to peel
// back -- simplest safe behaviour, and matches closeYear()'s own "one
// unambiguous button" philosophy. Re-closing walks forward year by year
// again from wherever reporting_year is.
export async function reopenYear(): Promise<void> {
  const admin = await requireAdmin();
  await query("UPDATE app_settings SET closed_through_year = NULL WHERE id = 1");
  await writeAudit(admin, "year.reopen");
  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// Users (login control)
// ---------------------------------------------------------------------------

export type UserRow = {
  id: number;
  username: string;
  name: string;
  role: "ADMIN" | "USER";
  permissions: string[] | null;
  active: boolean;
  last_login: string | null;
  locked: boolean;
  must_change_password: boolean;
};

export async function listUsers(): Promise<UserRow[]> {
  await requireAdmin();
  return query<UserRow>(
    `SELECT id, username, name, role, permissions, active, last_login::text AS last_login,
            (locked_until IS NOT NULL AND locked_until > now()) AS locked, must_change_password
     FROM users ORDER BY id`
  );
}

export async function createUser(input: { username: string; name: string; password: string; role: "ADMIN" | "USER" }): Promise<void> {
  const admin = await requireAdmin();
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);
  const taken = await queryOne("SELECT 1 FROM users WHERE lower(username) = lower($1)", [input.username]);
  if (taken) throw new Error(`The username "${input.username}" is already used.`);
  const hash = bcrypt.hashSync(input.password, 10);
  // The password the administrator types is a temporary one: the person picks their own at first sign-in.
  await query("INSERT INTO users (username, password_hash, name, role, must_change_password) VALUES ($1,$2,$3,$4,true)", [
    input.username,
    hash,
    input.name,
    input.role,
  ]);
  await writeAudit(admin, "user.create", `${input.username} (${input.role})`);
  revalidatePath("/settings");
}

/** At least one active administrator has to remain, whatever is being changed. */
async function assertAnotherAdminRemains(userId: number): Promise<void> {
  const row = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN' AND active AND id <> $1", [userId]);
  if (Number(row?.n ?? 0) === 0) throw new Error("That would leave no active administrator. Make someone else an administrator first.");
}

export async function updateUser(id: number, input: { name: string; role: "ADMIN" | "USER"; active: boolean }): Promise<void> {
  const admin = await requireAdmin();
  const before = await queryOne<{ role: string; active: boolean; username: string }>("SELECT role, active, username FROM users WHERE id = $1", [id]);
  if (!before) throw new Error("That user no longer exists.");
  if (admin.id === id && !input.active) throw new Error("You can't switch off the login you are using.");
  if (before.role === "ADMIN" && before.active && (input.role !== "ADMIN" || !input.active)) await assertAnotherAdminRemains(id);
  await query("UPDATE users SET name = $2, role = $3, active = $4 WHERE id = $1", [id, input.name, input.role, input.active]);
  await writeAudit(admin, "user.update", `${before.username}: role ${input.role}, ${input.active ? "on" : "off"}`);
  revalidatePath("/settings");
}

/** Which sections a user may open. null = all of them (admins always have all, whatever is stored). */
export async function setUserSections(id: number, sections: string[] | null): Promise<void> {
  const admin = await requireAdmin();
  const valid = new Set(SECTIONS.map((s) => s.key));
  const clean = sections === null ? null : sections.filter((s) => valid.has(s));
  await query("UPDATE users SET permissions = $2 WHERE id = $1", [id, clean]);
  await writeAudit(admin, "user.permissions", `user #${id}: ${clean === null ? "all sections" : clean.length + " sections"}`);
  revalidatePath("/settings");
}

/** Give a user a new temporary password; they must change it at their next sign-in. Also unlocks the login. */
export async function resetUserPassword(id: number, password: string): Promise<void> {
  const admin = await requireAdmin();
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const row = await queryOne<{ username: string }>(
    "UPDATE users SET password_hash = $2, must_change_password = true, failed_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING username",
    [id, bcrypt.hashSync(password, 10)]
  );
  if (!row) throw new Error("That user no longer exists.");
  await writeAudit(admin, "user.password-reset", row.username);
  revalidatePath("/settings");
}

export async function unlockUser(id: number): Promise<void> {
  const admin = await requireAdmin();
  const row = await queryOne<{ username: string }>("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING username", [id]);
  if (row) await writeAudit(admin, "user.unlock", row.username);
  revalidatePath("/settings");
}

export async function deleteUser(id: number): Promise<void> {
  const admin = await requireAdmin();
  if (admin.id === id) throw new Error("You can't delete your own account while logged in as it.");
  const before = await queryOne<{ role: string; active: boolean; username: string }>("SELECT role, active, username FROM users WHERE id = $1", [id]);
  if (before?.role === "ADMIN" && before.active) await assertAnotherAdminRemains(id);
  await query("DELETE FROM users WHERE id = $1", [id]);
  await writeAudit(admin, "user.delete", before?.username ?? `#${id}`);
  revalidatePath("/settings");
}

export type AuditRow = { id: number; at: string; username: string | null; action: string; detail: string | null };

export async function listAuditLog(limit = 200): Promise<AuditRow[]> {
  await requireAdmin();
  return query<AuditRow>(
    "SELECT id, at::text AS at, username, action, detail FROM audit_log ORDER BY at DESC, id DESC LIMIT $1",
    [limit]
  );
}
