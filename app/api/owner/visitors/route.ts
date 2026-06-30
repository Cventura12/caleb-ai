// GET /api/owner/visitors — returns the 50 most recent visitor log entries.
// Owner-only; verified via session cookie.

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { listRecentVisitors } from "@/lib/visitor-log";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isOwner = token ? await verifySessionToken(token) : false;
  if (!isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visitors = await listRecentVisitors(50);
  return NextResponse.json({ visitors });
}
