// Durable rate limiter backed by Supabase Postgres.
// Uses an atomic INSERT ... ON CONFLICT to avoid race conditions.
// Falls back to an in-memory map when Supabase is not configured.
//
// Why Supabase over Upstash Redis:
//   - Already in use, no extra service or credentials.
//   - Atomic Postgres upsert handles concurrency correctly.
//   - For a personal portfolio site, the ~20ms extra latency is negligible
//     compared to the Anthropic API round-trip.

import { isDbConfigured, getDb } from "./db";

// In-memory fallback (single-instance only; fine for dev or unconfigured prod)
const fallbackMap = new Map<string, { count: number; resetAt: number }>();

function fallbackCheck(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const rec = fallbackMap.get(key);
  if (!rec || now >= rec.resetAt) {
    fallbackMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.count >= max) return false;
  rec.count++;
  return true;
}

// Returns true if the request is allowed, false if the limit is exceeded.
// key     — unique identifier (e.g. `${ip}:chat`)
// windowS — window size in seconds
// max     — max requests per window
export async function checkRateLimit(
  key: string,
  windowS: number,
  max: number
): Promise<boolean> {
  if (!isDbConfigured()) {
    return fallbackCheck(key, windowS * 1000, max);
  }
  try {
    const db = getDb();
    const { data, error } = await db.rpc("check_rate_limit", {
      p_key: key,
      p_window_seconds: windowS,
      p_max: max,
    });
    if (error) {
      console.warn("[ratelimit] DB error, using fallback:", error.message);
      return fallbackCheck(key, windowS * 1000, max);
    }
    return data === true;
  } catch (err) {
    console.warn("[ratelimit] threw, using fallback:", err);
    return fallbackCheck(key, windowS * 1000, max);
  }
}
