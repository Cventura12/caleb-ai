import { get_current_time } from "./get_current_time";
import { get_availability } from "./get_availability";
import { create_scheduling_link } from "./create_scheduling_link";
import { leave_message } from "./leave_message";
import { owner_ping } from "./owner_ping";

// ─── Tool registry types ──────────────────────────────────────────────────────

export type Lane = "public" | "owner";

// Passed by the route handler to every tool execute() call.
// Tools that don't need it can simply omit the parameter — TypeScript allows
// functions with fewer parameters to be assigned to this interface.
export interface ToolExecutionContext {
  ip: string;
  sessionId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  // Controls which request contexts may see and execute this tool.
  // "public" — any visitor may trigger it.
  // "owner"  — only authenticated owner requests (future phase).
  // Enforced both at tool-list time (model only sees allowed tools) and
  // at execution time (double-checked before execute() is called).
  lane: Lane;
  // Present-progressive label shown to the visitor while the tool runs.
  statusLabel: string;
  execute: (input: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<string>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add new tools here. The agent loop reads this array — no other wiring needed.

export const TOOL_REGISTRY: ToolDefinition[] = [
  get_current_time,
  get_availability,
  create_scheduling_link,
  leave_message,
  owner_ping,
];
