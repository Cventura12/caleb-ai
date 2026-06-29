import type { ApiMessage, StreamEvent } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── API seam ──────────────────────────────────────────────────────────────────
// Consumes the SSE stream from /api/chat.
// Calls onStatus whenever the server emits a "status" event (tool running).
// Returns the model's final text reply.
// Throws ApiError on HTTP errors or stream-level failures.
// ──────────────────────────────────────────────────────────────────────────────
export async function getReply(
  messages: ApiMessage[],
  onStatus?: (label: string) => void
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch {
    throw new ApiError(0, "Network error");
  }

  // Non-2xx before the stream starts (e.g. 429 rate limit, 400 bad request)
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new ApiError(0, "No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      let event: StreamEvent;
      try {
        event = JSON.parse(line.slice(6)) as StreamEvent;
      } catch {
        continue;
      }

      if (event.type === "status") {
        onStatus?.(event.label);
      } else if (event.type === "text") {
        return event.content;
      } else if (event.type === "error") {
        throw new ApiError(500, event.message);
      }
    }
  }

  throw new ApiError(0, "Stream ended without a reply");
}
