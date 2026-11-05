import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { authSecretKey } from "@/lib/authSecret";
import { COMPANY_COOKIE, MASTER_COOKIE, multiCompany, sessionCookieName } from "@/lib/company-cookie";

const PUBLIC_PATHS = ["/login", "/companies"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Server components read the path from this header (the root layout uses it for section permissions).
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  const proceed = () => NextResponse.next({ request: { headers } });

  // Desktop app: nothing works until a company is chosen.
  const company = multiCompany() ? req.cookies.get(COMPANY_COOKIE)?.value : undefined;
  if (multiCompany() && !company && !pathname.startsWith("/companies")) {
    const url = req.nextUrl.clone();
    url.pathname = "/companies";
    return NextResponse.redirect(url);
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return proceed();
  }

  const token = req.cookies.get(sessionCookieName(company))?.value;
  let authenticated = false;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, authSecretKey());
      authenticated = (payload.company as string | undefined) === company;
      if (authenticated && payload.viaMaster) {
        // Opened by the master administrator: only valid while that login is still there.
        const master = req.cookies.get(MASTER_COOKIE)?.value;
        await jwtVerify(master ?? "", authSecretKey());
      }
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role-based gating (ADMIN-only Settings) and section permissions happen in the layouts,
  // not here -- middleware runs in the edge runtime and cannot reach Postgres.
  return proceed();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
