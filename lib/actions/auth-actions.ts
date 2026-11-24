"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { verifyCredentials, createSession, destroySession, hasAnyUser, getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { passwordProblem } from "@/lib/password-policy";

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) return { error: "Enter a username and password." };

  const result = await verifyCredentials(username, password);
  if ("error" in result) return { error: result.error };

  await createSession(result.user);
  redirect(result.user.mustChangePassword ? "/account" : "/");
}

export async function logoutAction() {
  const session = await getSession();
  if (session) await writeAudit(session, "logout");
  await destroySession();
  redirect("/login");
}

// First run on a new database: nobody exists yet, so the login page offers to create the administrator.
// Refused as soon as any user exists -- after that, users are managed in Settings.
export async function setupAdminAction(_prevState: { error?: string } | undefined, formData: FormData) {
  if (await hasAnyUser()) return { error: "Setup is already done. Sign in instead." };
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!name || !username || !password) return { error: "Enter your name, a username and a password." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const rows = await query<{ id: number }>(
    "INSERT INTO users (username, password_hash, name, role) VALUES ($1,$2,$3,'ADMIN') RETURNING id",
    [username, bcrypt.hashSync(password, 10), name]
  );
  await createSession({ id: rows[0].id, username, name, role: "ADMIN" });
  await writeAudit({ id: rows[0].id, username }, "setup", "first administrator created");
  redirect("/");
}

/** Anyone signed in can change their own password (the administrator may also have forced them to). */
export async function changeOwnPasswordAction(_prevState: { error?: string; success?: boolean } | undefined, formData: FormData) {
  const session = await getSession();
  if (!session || session.id <= 0) return { error: "Sign in with a company login to change a password." };
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [session.id]);
  if (!row || !bcrypt.compareSync(current, row.password_hash)) return { error: "The current password is not right." };
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== confirm) return { error: "The two new passwords do not match." };
  if (bcrypt.compareSync(next, row.password_hash)) return { error: "Choose a password you have not used before." };

  await query("UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1", [session.id, bcrypt.hashSync(next, 10)]);
  await writeAudit(session, "password.change");
  return { success: true };
}
