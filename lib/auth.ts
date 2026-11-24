import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { query, queryOne } from "./db";
import { writeAudit } from "./audit";
import { authSecretKey } from "./authSecret";
import { getMaster } from "./master-admin";
import { COMPANY_COOKIE, multiCompany, sessionCookieName } from "./company-cookie";

export type Role = "ADMIN" | "USER";
export type SessionUser = { id: number; username: string; name: string; role: Role; mustChangePassword?: boolean };

export const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

/**
 * Check a login. After MAX_FAILED_LOGINS wrong passwords in a row the user is locked for a while;
 * a switched-off user cannot sign in at all. Both are written to the audit log.
 */
export async function verifyCredentials(username: string, password: string): Promise<{ user: SessionUser } | { error: string }> {
  const row = await queryOne<{
    id: number;
    username: string;
    password_hash: string;
    name: string;
    role: Role;
    active: boolean;
    failed_attempts: number;
    locked_until: string | null;
    must_change_password: boolean;
  }>(
    `SELECT id, username, password_hash, name, role, active, failed_attempts, locked_until, must_change_password
     FROM users WHERE lower(username) = lower($1)`,
    [username]
  );
  if (!row) {
    await writeAudit(null, "login.failed", `unknown user "${username}"`);
    return { error: "Incorrect username or password." };
  }
  if (!row.active) {
    await writeAudit(row, "login.refused", "user is switched off");
    return { error: "This login has been switched off. Ask the administrator." };
  }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000);
    return { error: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or ask the administrator to unlock it.` };
  }
  if (!bcrypt.compareSync(password, row.password_hash)) {
    const attempts = row.failed_attempts + 1;
    const lock = attempts >= MAX_FAILED_LOGINS;
    await query(
      `UPDATE users SET failed_attempts = $2, locked_until = CASE WHEN $3::boolean THEN now() + ($4 || ' minutes')::interval ELSE locked_until END WHERE id = $1`,
      [row.id, lock ? 0 : attempts, lock, String(LOCK_MINUTES)]
    );
    await writeAudit(row, lock ? "login.locked" : "login.failed", `wrong password (${attempts} of ${MAX_FAILED_LOGINS})`);
    return { error: lock ? `Too many wrong passwords. This login is locked for ${LOCK_MINUTES} minutes.` : "Incorrect username or password." };
  }
  await query("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = now() WHERE id = $1", [row.id]);
  await writeAudit(row, "login");
  return { user: { id: row.id, username: row.username, name: row.name, role: row.role, mustChangePassword: row.must_change_password } };
}

export async function hasAnyUser(): Promise<boolean> {
  const row = await queryOne<{ n: string | number }>("SELECT COUNT(*) AS n FROM users");
  return Number(row?.n ?? 0) > 0;
}

// The session is kept per company (cookie name and a claim inside it), so signing in to one company
// never signs you in to another.
async function activeCompany(): Promise<string | undefined> {
  if (!multiCompany()) return undefined;
  return (await cookies()).get(COMPANY_COOKIE)?.value;
}

// viaMaster: the session was opened by the master administrator rather than a company login. It then only
// lasts while the master administrator is signed in (checked here and in middleware.ts).
export async function createSession(user: SessionUser, company?: string, viaMaster = false) {
  const companySlug = company ?? (await activeCompany());
  const token = await new SignJWT({ ...user, company: companySlug, ...(viaMaster ? { viaMaster: true } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(authSecretKey());
  const store = await cookies();
  store.set(sessionCookieName(companySlug), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(sessionCookieName(await activeCompany()));
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const company = await activeCompany();
  const token = store.get(sessionCookieName(company))?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecretKey());
    if ((payload.company as string | undefined) !== company) return null;
    if (payload.viaMaster && !(await getMaster())) return null;
    const user = payload as unknown as SessionUser;
    if (user.id > 0) {
      // Role, name and on/off are read fresh, so what an admin changes applies at once.
      const row = await queryOne<{ id: number; username: string; name: string; role: Role; active: boolean; must_change_password: boolean }>(
        "SELECT id, username, name, role, active, must_change_password FROM users WHERE id = $1",
        [user.id]
      );
      if (!row || !row.active) return null;
      return { id: row.id, username: row.username, name: row.name, role: row.role, mustChangePassword: row.must_change_password };
    }
    return user;
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

/**
 * The sections this user may open, or null for all of them. Read from the database on each call so a
 * change an admin makes in Settings applies straight away, without the user having to log in again.
 */
export async function getAllowedSections(user: SessionUser): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;
  const row = await queryOne<{ permissions: string[] | null }>("SELECT permissions FROM users WHERE id = $1", [user.id]);
  return row?.permissions ?? null;
}
