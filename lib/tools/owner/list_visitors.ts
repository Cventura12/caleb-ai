import type { ToolDefinition, ToolExecutionContext } from "../registry";
import { verifySessionToken } from "@/lib/session";
import { listRecentVisitors } from "@/lib/visitor-log";
import { logOwnerAction } from "@/lib/owner-actions";

export const list_visitors: ToolDefinition = {
  name: "list_visitors",
  description:
    "Returns recent visitor log entries — who came by, their gate answer, first message, and whether they booked or messaged. Use when asked about recent visitors, who stopped by, or visitor activity.",
  input_schema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Number of recent visitors to return (default 20, max 50).",
      },
    },
    required: [],
  },
  lane: "owner",
  statusLabel: "checking your visitors…",
  execute: async (input, ctx: ToolExecutionContext) => {
    if (!ctx.ownerToken || !(await verifySessionToken(ctx.ownerToken))) {
      return JSON.stringify({ error: "Unauthorized" });
    }
    const limit = Math.min(typeof input.limit === "number" ? input.limit : 20, 50);
    const visitors = await listRecentVisitors(limit);
    void logOwnerAction("list_visitors", { limit });
    return JSON.stringify({ visitors });
  },
};
