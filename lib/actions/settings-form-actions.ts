"use server";

import { PERMISSION_SECTIONS } from "@/lib/sections";
import {
  updateAppSettings,
  createUser,
  deleteUser,
  updateUser,
  resetUserPassword,
  unlockUser,
  setUserSections,
  closeYear,
  reopenYear,
  type AppSettings,
} from "@/lib/actions/settings-actions";

type FormState = { error?: string; success?: boolean } | undefined;

function str(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) || "").trim();
  return v || null;
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function updateSettingsFormAction(_prev: FormState, fd: FormData) {
  const input: AppSettings = {
    company_name: String(fd.get("company_name") || ""),
    vat_number: str(fd, "vat_number"),
    address: str(fd, "address"),
    zip: str(fd, "zip"),
    city: str(fd, "city"),
    country: str(fd, "country"),
    bank_name: str(fd, "bank_name"),
    iban: str(fd, "iban"),
    bic: str(fd, "bic"),
    telephone: str(fd, "telephone"),
    email: str(fd, "email"),
    website: str(fd, "website"),
    currency: String(fd.get("currency") || "€"),
    date_format: String(fd.get("date_format") || "dd-mmm-yyyy"),
    fiscal_year_start_month: Number(fd.get("fiscal_year_start_month") || 1),
    reporting_year: Number(fd.get("reporting_year")),
    payment_term_days: Number(fd.get("payment_term_days") || 0),
    vat_rate_1: Number(fd.get("vat_rate_1") || 0),
    vat_rate_2: Number(fd.get("vat_rate_2") || 0),
    vat_rate_3: Number(fd.get("vat_rate_3") || 0),
    vat_rate_4: fd.get("vat_rate_4") ? Number(fd.get("vat_rate_4")) : null,
    client_label: String(fd.get("client_label") || "").trim() || "Clients",
    project_label: String(fd.get("project_label") || "").trim() || "Projects",
    account_no_interest_expense: fd.get("account_no_interest_expense") ? Number(fd.get("account_no_interest_expense")) : null,
  };
  if (!input.company_name) return { error: "Company name is required." };
  try {
    await updateAppSettings(input);
  } catch (e) {
    return { error: message(e, "Could not save settings.") };
  }
  return { success: true };
}

export async function createUserFormAction(_prev: FormState, fd: FormData) {
  const username = String(fd.get("username") || "").trim();
  const name = String(fd.get("name") || "").trim();
  const password = String(fd.get("password") || "");
  const role = String(fd.get("role") || "USER") as "ADMIN" | "USER";
  if (!username || !name || !password) return { error: "Username, name and password are all required." };
  try {
    await createUser({ username, name, password, role });
  } catch (e) {
    return { error: message(e, "Could not create user.") };
  }
  return { success: true };
}

export async function updateUserFormAction(id: number, _prev: FormState, fd: FormData) {
  const name = String(fd.get("name") || "").trim();
  if (!name) return { error: "Enter a name." };
  try {
    await updateUser(id, {
      name,
      role: String(fd.get("role") || "USER") === "ADMIN" ? "ADMIN" : "USER",
      active: fd.get("active") === "on",
    });
  } catch (e) {
    return { error: message(e, "Could not save.") };
  }
  return { success: true };
}

export async function resetPasswordFormAction(id: number, _prev: FormState, fd: FormData) {
  try {
    await resetUserPassword(id, String(fd.get("password") || ""));
  } catch (e) {
    return { error: message(e, "Could not reset the password.") };
  }
  return { success: true };
}

export async function unlockUserFormAction(id: number, _prev: FormState, _fd: FormData) {
  try {
    await unlockUser(id);
  } catch (e) {
    return { error: message(e, "Could not unlock.") };
  }
  return { success: true };
}

export async function saveUserSectionsAction(id: number, _prev: FormState, fd: FormData) {
  const chosen = fd.getAll("sections").map(String);
  // Everything ticked is stored as "no restriction", so sections added later are open to the user too.
  const all = PERMISSION_SECTIONS.every((s) => chosen.includes(s.key));
  try {
    await setUserSections(id, all ? null : chosen);
  } catch (e) {
    return { error: message(e, "Could not save.") };
  }
  return { success: true };
}

export async function deleteUserFormAction(id: number, _prev: FormState, _fd: FormData) {
  try {
    await deleteUser(id);
  } catch (e) {
    return { error: message(e, "Could not delete the user.") };
  }
  return { success: true };
}

export async function closeYearFormAction(_prev: FormState, _fd: FormData) {
  try {
    await closeYear();
  } catch (e) {
    return { error: message(e, "Could not close the year.") };
  }
  return { success: true };
}

export async function reopenYearFormAction(_prev: FormState, _fd: FormData) {
  try {
    await reopenYear();
  } catch (e) {
    return { error: message(e, "Could not reopen the year.") };
  }
  return { success: true };
}
