"use server";

import { SECTIONS } from "@/lib/sections";
import { updateAppSettings, createUser, deleteUser, setUserSections, closeYear, reopenYear, type AppSettings } from "@/lib/actions/settings-actions";

function str(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) || "").trim();
  return v || null;
}

export async function updateSettingsFormAction(_prev: { error?: string; success?: boolean } | undefined, fd: FormData) {
  const input: AppSettings = {
    company_name: String(fd.get("company_name") || ""),
    vat_number: str(fd, "vat_number"),
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
    vat_rate_1: Number(fd.get("vat_rate_1") || 0),
    vat_rate_2: Number(fd.get("vat_rate_2") || 0),
    vat_rate_3: Number(fd.get("vat_rate_3") || 0),
    vat_rate_4: fd.get("vat_rate_4") ? Number(fd.get("vat_rate_4")) : null,
  };
  if (!input.company_name) return { error: "Company name is required." };
  try {
    await updateAppSettings(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save settings." };
  }
  return { success: true };
}

export async function createUserFormAction(_prev: { error?: string; success?: boolean } | undefined, fd: FormData) {
  const username = String(fd.get("username") || "").trim();
  const name = String(fd.get("name") || "").trim();
  const password = String(fd.get("password") || "");
  const role = String(fd.get("role") || "USER") as "ADMIN" | "USER";
  if (!username || !name || !password) return { error: "Username, name and password are all required." };
  try {
    await createUser({ username, name, password, role });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create user." };
  }
  return { success: true };
}

export async function saveUserSectionsAction(id: number, _prev: { error?: string; success?: boolean } | undefined, fd: FormData) {
  const chosen = fd.getAll("sections").map(String);
  // Everything ticked is stored as "no restriction", so sections added later are open to the user too.
  const all = SECTIONS.every((s) => chosen.includes(s.key));
  try {
    await setUserSections(id, all ? null : chosen);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
  return { success: true };
}

export async function deleteUserAction(id: number) {
  await deleteUser(id);
}

export async function closeYearFormAction(_prev: { error?: string; success?: boolean } | undefined, _fd: FormData) {
  try {
    await closeYear();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not close the year." };
  }
  return { success: true };
}

export async function reopenYearFormAction(_prev: { error?: string; success?: boolean } | undefined, _fd: FormData) {
  try {
    await reopenYear();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reopen." };
  }
  return { success: true };
}
