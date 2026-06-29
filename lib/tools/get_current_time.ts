import type { ToolDefinition } from "./registry";

export const get_current_time: ToolDefinition = {
  name: "get_current_time",
  description:
    "Returns the current date and time. Call this when the visitor asks what time it is, what day it is, or anything requiring knowledge of the current date/time.",
  input_schema: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "IANA timezone string (e.g. 'America/New_York', 'America/Chicago'). Defaults to 'America/New_York'.",
      },
    },
    required: [],
  },
  lane: "public",
  statusLabel: "checking the time…",
  execute: async (input) => {
    const tz =
      typeof input.timezone === "string" && input.timezone
        ? input.timezone
        : "America/New_York";
    try {
      const now = new Date();
      return now.toLocaleString("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return new Date().toUTCString();
    }
  },
};
