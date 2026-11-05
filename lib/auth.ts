import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";
import { authSecretKey } from "./authSecret";

const COOKIE_NAME = "session";

export type Role = "ADMIN" | "USER";
export type SessionUser = { id: number; username: string; name: string; role: Role };

export async function verifyCredentials(username: string, password: string): Promise<SessionUser | null> {
  const row = await queryOne<{ id: number; username: string; password_hash: string; name: string; role: Role }>(
    "SELECT id, username, password_hash, name, role FROM users WHERE username = $1",
    [username]
  );
  if (!row) return null;
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, username: row.username, name: row.name, role: row.role };
}

export async function hasAnyUser(): Promise<boolean> {
  const row = await queryOne<{ n: string | number }>("SELECT COUNT(*) AS n FROM users");
  return Number(row?.n ?? 0) > 0;
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(authSecretKey());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecretKey());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

/** Guard for a Server Action -- throws rather than redirecting, since an action has no page to send the user to. */
export async function requireAdminForAction(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("FORBIDDEN: admin access required");
  return session;
}

/**
 * Guard for a Server Component / layout (Settings is the only ADMIN-only
 * area -- ported from the workbook's LoginForm macro, which only ever hid the
 * Settings sheet from non-admins; everything else was visible to any logged
 * in user). Redirects rather than throwing so a non-admin who follows a
 * stale link lands somewhere sensible.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/no-access");
  return session;
}
