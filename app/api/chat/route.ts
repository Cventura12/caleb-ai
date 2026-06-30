import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { SYSTEM_PROMPT } from "@/lib/knowledge";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import type { Lane } from "@/lib/tools/registry";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Rate limiting ────────────────────────────────────────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX = 20;
const RATE_WINDOW = 60_000;

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

type SimpleMessage = { role: "user" | "assistant"; content: string };

function parseMessages(body: unknown): SimpleMessage[] | null {
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
  return messages as SimpleMessage[];
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────
const enc = new TextEncoder();

function sse(event: StreamEvent): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Agent loop ───────────────────────────────────────────────────────────────
// Calls Anthropic with tools, processes tool_use blocks, loops until end_turn.
// All events are pushed to the ReadableStream controller as SSE frames.

const MAX_ITER = 5;

async function runAgentLoop(
  initialMessages: SimpleMessage[],
  lane: Lane,
  ip: string,
  ctrl: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Lane enforcement: filter registry to what this lane may see ────────────
  // Step 1: only allowed tools are sent to the model.
  const allowedTools = TOOL_REGISTRY.filter((t) => t.lane === lane);
  const allowedNames = new Set(allowedTools.map((t) => t.name));

  const toolDefs: Anthropic.Tool[] = allowedTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  // Mutable history — grows as the loop adds assistant/tool-result turns.
  const messages: Anthropic.MessageParam[] = initialMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      tools: toolDefs,
      messages,
    });

    console.log(`[agent] iter=${i} stop_reason="${response.stop_reason}" content_types=[${response.content.map((b) => b.type).join(",")}]`);

    // ── Final text answer ────────────────────────────────────────────────────
    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      ctrl.enqueue(sse({ type: "text", content: text }));
      return;
    }

    // ── Tool use ─────────────────────────────────────────────────────────────
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      // Append the assistant's full turn (with tool_use blocks) to history.
      // Cast needed: response ContentBlock vs param ContentBlockParam differ
      // only by extra fields on some subtypes — the data is semantically correct.
      messages.push({
        role: "assistant",
        content: response.content as unknown as Anthropic.ContentBlockParam[],
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const tu of toolUseBlocks) {
        console.log(`[agent] tool_use: name="${tu.name}" id="${tu.id}" input=${JSON.stringify(tu.input)}`);
        console.log(`[agent] allowed names: [${[...allowedNames].join(", ")}]`);

        // ── Lane enforcement: Step 2 — re-verify at execution time ─────────
        if (!allowedNames.has(tu.name)) {
          console.warn(`[agent] BLOCKED — tool "${tu.name}" not in lane "${lane}"`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Error: tool "${tu.name}" is not available.`,
            is_error: true,
          });
          continue;
        }

        const tool = TOOL_REGISTRY.find((t) => t.name === tu.name)!;
        console.log(`[agent] found tool in registry: "${tool.name}" — calling execute()`);

        // Emit status BEFORE executing so the client sees it immediately.
        ctrl.enqueue(sse({ type: "status", label: tool.statusLabel }));

        let result: string;
        try {
          result = await tool.execute(tu.input as Record<string, unknown>, { ip });
          console.log(`[agent] tool execute succeeded: "${tool.name}" → result:`, result.slice(0, 300));
        } catch (err) {
          console.error(`[agent] tool execute THREW: "${tool.name}" →`, err);
          result = `Error: ${err instanceof Error ? err.message : "tool failed"}`;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      }

      // Append tool results as the next user turn and loop.
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason (e.g. max_tokens) — bail.
    break;
  }

  // Safety cap: MAX_ITER exhausted or unexpected stop reason.
  ctrl.enqueue(
    sse({ type: "error", message: "ah something took too long on my end — try again in a sec" })
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Rate limit
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  if (!isAllowed(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Validate messages
  const messages = parseMessages(body);
  if (!messages) {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Lane — derived entirely from the verified session cookie.
  // Client input cannot influence this: the cookie is HttpOnly and the
  // check is server-side. No valid session → always "public".
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const isOwner = sessionToken ? await verifySessionToken(sessionToken) : false;
  const lane: Lane = isOwner ? "owner" : "public";

  // 5. Stream the agent loop as SSE
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      try {
        await runAgentLoop(messages, lane, ip, ctrl);
      } catch (err) {
        console.error("[/api/chat] Agent loop error:", err);
        ctrl.enqueue(
          sse({ type: "error", message: "ah something glitched on my end — try again in a sec" })
        );
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
