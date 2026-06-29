import type { ApiMessage } from "./types";

// Thrown on any non-2xx or network failure so callers can branch on status.
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── API SEAM ────────────────────────────────────────────────────────────────
// Single boundary between the UI and the server route.
// Accepts the full conversation history already mapped to "user"/"assistant".
// Returns the AI's reply text.
// The API key and system prompt live on the server — never here.
// ─────────────────────────────────────────────────────────────────────────────
export async function getReply(messages: ApiMessage[]): Promise<string> {
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

  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`);
  }

  const data = (await res.json()) as { reply: string };
  return data.reply;
}
