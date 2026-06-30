import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createSessionToken, SESSION_COOKIE, COOKIE_OPTIONS } from "@/lib/session";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Timing-safe password check. SHA-256 both sides so timingSafeEqual
// receives equal-length buffers regardless of password length.
function checkPassword(submitted: string): boolean {
  const stored = process.env.OWNER_PASSWORD;
  if (!stored) return false;
  const a = createHash("sha256").update(submitted, "utf8").digest();
  const b = createHash("sha256").update(stored, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Durable rate limit: 5 attempts per IP per 15 minutes
  const allowed = await checkRateLimit(`${ip}:owner_login`, 900, 5);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts — try again later" },
      { status: 429 }
    );
  }

  let password: string;
  try {
    const body = await req.json();
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
  return res;
}
