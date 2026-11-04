import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { authSecretKey } from "@/lib/authSecret";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  let authenticated = false;

  if (token) {
    try {
      await jwtVerify(token, authSecretKey());
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role-based gating (ADMIN-only Settings) happens in app/settings/layout.tsx,
  // not here -- middleware runs in the edge runtime and cannot reach Postgres.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
