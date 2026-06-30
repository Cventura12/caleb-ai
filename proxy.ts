// Next.js 16 renamed middleware.ts → proxy.ts.
// Proxy now defaults to Node.js runtime (no Edge constraints).
//
// What this does: session-gate every /owner/* page and /api/owner/* route.
// Login, logout, and the public chat API are excluded from gating.
//
// Security model: the proxy performs the ONLY server-side guard for owner
// pages. If the session cookie is missing, tampered, or expired, the visitor
// is redirected to /owner/login (pages) or receives 401 (API routes) before
// any page or route handler ever runs. No client-side JS involved.

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Paths that are always publicly accessible — never gated.
const PUBLIC_OWNER_PATHS = new Set([
  "/owner/login",
  "/api/owner/login",
  "/api/owner/logout",
]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths pass through with no check.
  if (PUBLIC_OWNER_PATHS.has(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySessionToken(token) : false;

  if (!valid) {
    if (pathname.startsWith("/api/owner/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Page route — redirect to login, preserving the intended destination.
    const loginUrl = new URL("/owner/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/api/owner/:path*"],
};
