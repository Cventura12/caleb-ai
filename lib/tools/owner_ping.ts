import type { ToolDefinition } from "./registry";

// Temporary owner-lane smoke-test tool.
// Proves that: (a) authenticated owners can invoke it, and
// (b) public visitors cannot reach it even if they name it explicitly —
// the lane enforcement in the agent loop blocks it before execute() runs.
export const owner_ping: ToolDefinition = {
  name: "owner_ping",
  description:
    "Confirms that the current session has owner access. Returns a simple acknowledgement.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
  lane: "owner",
  statusLabel: "checking owner access…",
  execute: async (_input, _ctx) => {
    return JSON.stringify({ confirmed: true, message: "owner access confirmed" });
  },
};
