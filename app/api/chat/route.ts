import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/knowledge";

// Run on Node.js runtime (not Edge) — required for the Anthropic SDK.
export const runtime = "nodejs";

// Never cache this route — every request must run fresh.
export const dynamic = "force-dynamic";

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Simple in-memory map keyed by IP. Resets on every server restart / Vercel
// redeploy. Good enough for launch; swap for Upstash Redis (or similar) when
// real traffic warrants a durable store.
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX = 20;          // requests per window
const RATE_WINDOW = 60_000;   // 1 minute in ms

function isAllowed(ip: string): boolean {
  const now = Date.now();
  const rec = rateMap.get(ip);

  if (!rec || now >= rec.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (rec.count >= RATE_MAX) return false;
  rec.count++;
  return true;
}

// ─── Input validation ─────────────────────────────────────────────────────────
const MAX_MESSAGES = 50;
const MAX_CONTENT_LEN = 4000;

type MessageParam = { role: "user" | "assistant"; content: string };

function parseMessages(body: unknown): MessageParam[] | null {
  if (!body || typeof body !== "object") return null;
  const { messages } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  if (messages.length > MAX_MESSAGES) return null;

  for (const m of messages) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length === 0) return null;
    if (content.length > MAX_CONTENT_LEN) return null;
  }

  return messages as MessageParam[];
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Rate limit
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  if (!isAllowed(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // 3. Validate messages
  const messages = parseMessages(body);
  if (!messages) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // 4. Call Anthropic
  // The API key is read from process.env — server-side only, never sent to the client.
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    });

    // Concatenate all text blocks (handles multi-block responses)
    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return NextResponse.json({ reply });
  } catch (error) {
    // Log full error server-side; return nothing identifiable to the client.
    console.error("[/api/chat] Anthropic call failed:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
