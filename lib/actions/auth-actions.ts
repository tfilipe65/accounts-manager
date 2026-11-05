"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { verifyCredentials, createSession, destroySession, hasAnyUser } from "@/lib/auth";
import { query } from "@/lib/db";

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) return { error: "Enter a username and password." };

  const user = await verifyCredentials(username, password);
  if (!user) return { error: "Incorrect username or password." };

  await createSession(user);
  redirect("/");
}

export async function logoutAction() {
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
  if (password.length < 6) return { error: "The password needs at least 6 characters." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const rows = await query<{ id: number }>(
    "INSERT INTO users (username, password_hash, name, role) VALUES ($1,$2,$3,'ADMIN') RETURNING id",
    [username, bcrypt.hashSync(password, 10), name]
  );
  await createSession({ id: rows[0].id, username, name, role: "ADMIN" });
  redirect("/");
}
