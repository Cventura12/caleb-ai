import { get_current_time } from "./get_current_time";
import { get_availability } from "./get_availability";
import { create_scheduling_link } from "./create_scheduling_link";

// ─── Tool registry types ──────────────────────────────────────────────────────

export type Lane = "public" | "owner";

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
  execute: (input: Record<string, unknown>) => Promise<string>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add new tools here. The agent loop reads this array — no other wiring needed.

export const TOOL_REGISTRY: ToolDefinition[] = [
  get_current_time,
  get_availability,
  create_scheduling_link,
];
