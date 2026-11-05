"use server";

// The one shared "which year am I looking at" value for the whole app --
// a `ry` cookie (not a per-page `?year=`, which the Dashboard used before
// this file existed) so a single choice in the nav selector applies to
// every page without threading a query param through every link. Falls
// back to app_settings.reporting_year, then the real current year.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { queryOne } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { currentCompanySlug } from "@/lib/current-company";
import { reportingYearCookieName } from "@/lib/company-cookie";

// One year choice per company: Test sits in 2020 while a live company is in the current year.
const cookieName = async () => reportingYearCookieName(await currentCompanySlug());

export async function getEffectiveReportingYear(): Promise<number> {
  await requireSession();
  const store = await cookies();
  const raw = store.get(await cookieName())?.value;
  const fromCookie = raw ? Number(raw) : NaN;
  if (Number.isFinite(fromCookie)) return fromCookie;

  const settings = await queryOne<{ reporting_year: number }>("SELECT reporting_year FROM app_settings WHERE id = 1");
  return settings?.reporting_year ?? new Date().getFullYear();
}

export async function setReportingYearAction(year: number, path: string): Promise<void> {
  await requireSession();
  const store = await cookies();
  store.set(await cookieName(), String(year), { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath(path);
}
