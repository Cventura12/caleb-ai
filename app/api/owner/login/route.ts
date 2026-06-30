import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createSessionToken, SESSION_COOKIE, COOKIE_OPTIONS } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Brute-force guard ─────────────────────────────────────────────────────────
// 5 attempts per IP per 15 minutes. In-memory — same tradeoff as the chat
// rate limiter. A durable store would harden this against multi-instance
// deployments, but this is already dramatically harder to brute-force than a
// plain string compare.
const loginRateMap = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX = 5;
const LOGIN_WINDOW = 15 * 60 * 1000; // 15 minutes

function isLoginAllowed(ip: string): boolean {
  const now = Date.now();
  const rec = loginRateMap.get(ip);
  if (!rec || now >= rec.resetAt) {
    loginRateMap.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW });
    return true;
  }
  if (rec.count >= LOGIN_MAX) return false;
  rec.count++;
  return true;
}

// ── Password check ────────────────────────────────────────────────────────────
// SHA-256 both sides then timingSafeEqual:
//   • timingSafeEqual eliminates timing-based enumeration.
//   • Hashing both operands to equal-length buffers is required by
//     timingSafeEqual (it throws if lengths differ) and adds a small
//     extra layer so the plaintext is never compared directly.
function checkPassword(submitted: string): boolean {
  const stored = process.env.OWNER_PASSWORD;
  if (!stored) return false; // not configured — fail closed
  const a = createHash("sha256").update(submitted, "utf8").digest();
  const b = createHash("sha256").update(stored, "utf8").digest();
  return timingSafeEqual(a, b);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!isLoginAllowed(ip)) {
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
    // Generic message — does not reveal whether the password, or the
    // OWNER_PASSWORD env var, is missing or wrong.
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
  return res;
}
