// Cookie names shared by the server code and middleware.ts (edge runtime: no node imports here).
//
// The desktop app holds several companies, each with its own database and its own users, so the
// login session is kept per company: signing in to one company never signs you in to another.
// With a single real Postgres (DATABASE_URL set) there is one company and none of this applies.

export const COMPANY_COOKIE = "company";
export const MASTER_COOKIE = "master";

export function multiCompany(): boolean {
  return !process.env.DATABASE_URL;
}

export function sessionCookieName(company: string | undefined): string {
  return company ? `session.${company}` : "session";
}

export function reportingYearCookieName(company: string | undefined): string {
  return company ? `ry.${company}` : "ry";
}
