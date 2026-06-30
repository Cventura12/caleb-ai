// GET /api/owner/me — lightweight session check for the chat UI.
// Returns { isOwner: boolean }. No sensitive data. Safe to call from client.

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isOwner = token ? await verifySessionToken(token) : false;
  return NextResponse.json({ isOwner });
}
