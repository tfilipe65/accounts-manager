"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addCompany, getCompany } from "@/lib/companies";
import { COMPANY_COOKIE } from "@/lib/company-cookie";
import { passwordProblem } from "@/lib/password-policy";
import { createSession } from "@/lib/auth";
import {
  createMasterAdmin,
  createMasterSession,
  destroyMasterSession,
  getMaster,
  hasMasterAdmin,
  verifyMaster,
} from "@/lib/master-admin";

type FormState = { error?: string } | undefined;

/** Open a company. The master administrator goes straight in as that company's admin; anyone else signs in with the company's own users. */
export async function openCompanyAction(slug: string) {
  if (!getCompany(slug)) redirect("/companies");
  (await cookies()).set(COMPANY_COOKIE, slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  const master = await getMaster();
  if (master) {
    await createSession({ id: 0, username: master.username, name: master.name, role: "ADMIN" }, slug, true);
    redirect("/");
  }
  redirect("/login");
}

export async function setupMasterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (hasMasterAdmin()) return { error: "The administrator account already exists. Sign in instead." };
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!name || !username || !password) return { error: "Enter your name, a username and a password." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "The two passwords do not match." };
  await createMasterSession(createMasterAdmin({ name, username, password }));
  redirect("/companies");
}

export async function masterLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const master = verifyMaster(String(formData.get("username") || "").trim(), String(formData.get("password") || ""));
  if (!master) return { error: "Incorrect administrator username or password." };
  await createMasterSession(master);
  redirect("/companies");
}

export async function masterLogoutAction() {
  await destroyMasterSession();
  redirect("/companies");
}

export async function addCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getMaster())) return { error: "Only the administrator can add companies." };
  try {
    const template = String(formData.get("template") || "C");
    addCompany(String(formData.get("name") || ""), String(formData.get("description") || ""), (["C", "W", "I", "P", "K"].includes(template) ? template : "C") as "C" | "W" | "I" | "P" | "K");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add the company." };
  }
  revalidatePath("/companies");
  return undefined;
}
