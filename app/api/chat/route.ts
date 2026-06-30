import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { SYSTEM_PROMPT, OWNER_SYSTEM_PROMPT_EXTENSION } from "@/lib/knowledge";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import type { Lane, ToolDefinition } from "@/lib/tools/registry";
import type { StreamEvent } from "@/lib/types";
import { getEnabledToolNames, getEnabledMcpConnectors } from "@/lib/connectors";
import { buildMcpTools } from "@/lib/mcp";
import { checkRateLimit } from "@/lib/ratelimit";
import { logVisitor, updateVisitorAction } from "@/lib/visitor-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Input validation ─────────────────────────────────────────────────────────
const MAX_MESSAGES = 50;
const MAX_CONTENT_LEN = 4000;

// Per-session message cap: owner is trusted so cap only applies to public.
const SESSION_MSG_CAP = 30;

type SimpleMessage = { role: "user" | "assistant"; content: string };

interface ParsedBody {
  messages: SimpleMessage[];
  sessionId?: string;
  gateAnswer?: string;
}

function parseBody(body: unknown): ParsedBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const { messages, sessionId, gateAnswer } = b;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  if (messages.length > MAX_MESSAGES) return null;

  for (const m of messages) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length === 0) return null;
    if (content.length > MAX_CONTENT_LEN) return null;
  }

  return {
    messages: messages as SimpleMessage[],
    sessionId: typeof sessionId === "string" ? sessionId.slice(0, 64) : undefined,
    gateAnswer: typeof gateAnswer === "string" ? gateAnswer.slice(0, 500) : undefined,
  };
}

// ─── History trimming ─────────────────────────────────────────────────────────
// Keeps conversation tokens bounded while preserving the gate-seed framing.
// Rule: always keep messages[0] (the seed) + the most recent MAX_HISTORY - 1 messages.
const MAX_HISTORY = 20;

function trimHistory(messages: SimpleMessage[]): SimpleMessage[] {
  if (messages.length <= MAX_HISTORY) return messages;
  return [messages[0], ...messages.slice(-(MAX_HISTORY - 1))];
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────
const enc = new TextEncoder();

function sse(event: StreamEvent): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Connector-managed tool names ─────────────────────────────────────────────
const CONNECTOR_MANAGED_TOOLS = new Set([
  "get_availability",
  "create_scheduling_link",
  "leave_message",
]);

// Tools whose success should be recorded as visitor actions.
const ACTION_TOOLS: Record<string, "booked" | "messaged"> = {
  create_scheduling_link: "booked",
  leave_message: "messaged",
};

// ─── Agent loop ───────────────────────────────────────────────────────────────
const MAX_ITER = 5;

async function runAgentLoop(
  initialMessages: SimpleMessage[],
  lane: Lane,
  ip: string,
  sessionId: string | undefined,
  ownerToken: string | undefined,
  ctrl: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── 1. Load connector state from DB ───────────────────────────────────────
  let enabledConnectorTools: Set<string>;
  let mcpConnectors: Awaited<ReturnType<typeof getEnabledMcpConnectors>> = [];
  try {
    [enabledConnectorTools, mcpConnectors] = await Promise.all([
      getEnabledToolNames(),
      getEnabledMcpConnectors(),
    ]);
  } catch (err) {
    console.warn("[agent] Connector DB unavailable, using defaults:", err);
    enabledConnectorTools = new Set(CONNECTOR_MANAGED_TOOLS);
  }

  // ── 2. Filter built-in tools ──────────────────────────────────────────────
  const allowedBuiltins = TOOL_REGISTRY.filter((t) => {
    const laneOk = lane === "owner" || t.lane === "public";
    if (!laneOk) return false;
    if (CONNECTOR_MANAGED_TOOLS.has(t.name)) return enabledConnectorTools.has(t.name);
    return true;
  });

  // ── 3. Build MCP proxy tools ──────────────────────────────────────────────
  let mcpTools: ToolDefinition[] = [];
  if (mcpConnectors.length > 0) {
    const arrays = await Promise.all(
      mcpConnectors.map((c) =>
        buildMcpTools(c, lane).catch((err) => {
          console.error(`[agent] MCP "${c.name}" failed:`, err);
          return [] as ToolDefinition[];
        })
      )
    );
    mcpTools = arrays.flat();
  }

  // ── 4. Combined tool list ─────────────────────────────────────────────────
  const allAllowedTools: ToolDefinition[] = [...allowedBuiltins, ...mcpTools];
  const allowedNames = new Set(allAllowedTools.map((t) => t.name));

  const toolDefs: Anthropic.Tool[] = allAllowedTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = initialMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: lane === "owner"
        ? SYSTEM_PROMPT + "\n\n" + OWNER_SYSTEM_PROMPT_EXTENSION
        : SYSTEM_PROMPT,
      tools: toolDefs,
      messages,
    });

    console.log(
      `[agent] iter=${i} stop_reason="${response.stop_reason}" lane="${lane}" tools=[${allAllowedTools.map((t) => t.name).join(",")}]`
    );

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      ctrl.enqueue(sse({ type: "text", content: text }));
      return;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      messages.push({
        role: "assistant",
        content: response.content as unknown as Anthropic.ContentBlockParam[],
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const tu of toolUseBlocks) {
        console.log(
          `[agent] tool_use: name="${tu.name}" id="${tu.id}" input=${JSON.stringify(tu.input)}`
        );

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

        const tool = allAllowedTools.find((t) => t.name === tu.name)!;
        ctrl.enqueue(sse({ type: "status", label: tool.statusLabel }));

        let result: string;
        try {
          result = await tool.execute(tu.input as Record<string, unknown>, {
            ip,
            sessionId,
            ownerToken,
          });
          console.log(`[agent] "${tool.name}" succeeded:`, result.slice(0, 300));

          // Record visitor action on first success for tracked tools.
          if (sessionId && ACTION_TOOLS[tu.name]) {
            try {
              const parsed = JSON.parse(result) as { success?: boolean };
              if (parsed.success === true) {
                void updateVisitorAction(sessionId, ACTION_TOOLS[tu.name]);
              }
            } catch {
              // Non-JSON result — skip action tracking
            }
          }
        } catch (err) {
          console.error(`[agent] "${tool.name}" threw:`, err);
          result = `Error: ${err instanceof Error ? err.message : "tool failed"}`;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  ctrl.enqueue(
    sse({ type: "error", message: "ah something took too long on my end — try again in a sec" })
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

  // Durable rate limit: 20 requests per IP per minute
  const allowed = await checkRateLimit(`${ip}:chat`, 60, 20);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Too many requests." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages: rawMessages, sessionId, gateAnswer } = parsed;

  // Lane — derived entirely from the verified session cookie.
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const isOwner = sessionToken ? await verifySessionToken(sessionToken) : false;
  const lane: Lane = isOwner ? "owner" : "public";

  // Per-session message cap (public only — owner is trusted).
  if (lane === "public" && rawMessages.length > SESSION_MSG_CAP) {
    return new Response(
      JSON.stringify({ error: "Conversation limit reached — start a new session." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Trim history to avoid token bloat, preserving the seed framing.
  const messages = trimHistory(rawMessages);

  // Log visitor on first message (just the gate seed, no prior exchange).
  if (lane === "public" && sessionId && rawMessages.length === 1) {
    void logVisitor(sessionId, gateAnswer ?? null, rawMessages[0].content);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      try {
        await runAgentLoop(messages, lane, ip, sessionId, isOwner ? sessionToken : undefined, ctrl);
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
