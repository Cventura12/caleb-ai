import type { ToolDefinition } from "./registry";
import { getMyUri, getEventType, createSchedulingLink } from "./calendly";

export const create_scheduling_link: ToolDefinition = {
  name: "create_scheduling_link",
  description:
    "Creates a single-use scheduling link for a visitor to book a meeting with Caleb. Use this when the visitor is ready to book — after checking availability or when they express clear intent to schedule. The visitor picks a time, enters their name and email, and gets a calendar invite — all on Calendly's own page. No personal data is needed from them here.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
  lane: "public",
  statusLabel: "setting up your booking…",
  execute: async (_input) => {
    const userUri = await getMyUri();
    const eventType = await getEventType(userUri);

    if (!eventType) {
      return JSON.stringify({
        success: false,
        reason: "no_event_type",
        message: "No bookable event type configured.",
      });
    }

    const bookingUrl = await createSchedulingLink(eventType.uri);

    return JSON.stringify({
      success: true,
      bookingUrl,
      eventType: eventType.name,
      duration: eventType.duration,
      note: "Present this link to the visitor. It's single-use — once someone books via this URL, it expires. They'll pick a time, enter their info, and get a calendar invite automatically.",
    });
  },
};
