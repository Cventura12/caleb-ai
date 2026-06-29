// Narrowly-scoped Calendly API client.
// Only exposes three operations: read my event types (filtered by slug),
// read available times for that event type, and create a single-use
// scheduling link. No access to existing bookings, invitees, or account data.

const BASE = "https://api.calendly.com";

function authHeaders() {
  const token = process.env.CALENDLY_API_TOKEN;
  if (!token) throw new Error("Calendly is not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ─── User URI ─────────────────────────────────────────────────────────────────
// Needed to scope the event_types list to my account.
// Result is stable per-token so callers may cache it if desired.
export async function getMyUri(): Promise<string> {
  const res = await fetch(`${BASE}/users/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Calendly auth error (${res.status})`);
  const body = (await res.json()) as { resource: { uri: string } };
  return body.resource.uri;
}

// ─── Event type ───────────────────────────────────────────────────────────────
// Returns the single event type whose slug matches CALENDLY_EVENT_SLUG.
// Returns null if no active match is found — callers surface this gracefully.
export interface CalendlyEventType {
  uri: string;
  name: string;
  duration: number; // minutes
}

export async function getEventType(userUri: string): Promise<CalendlyEventType | null> {
  const slug = process.env.CALENDLY_EVENT_SLUG ?? "30min";

  const url = new URL(`${BASE}/event_types`);
  url.searchParams.set("user", userUri);
  url.searchParams.set("active", "true");
  url.searchParams.set("count", "100");

  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch event types (${res.status})`);

  const body = (await res.json()) as {
    collection: Array<{ uri: string; name: string; duration: number; slug: string; active: boolean }>;
  };

  const match = body.collection.find((et) => et.slug === slug && et.active);
  if (!match) return null;
  return { uri: match.uri, name: match.name, duration: match.duration };
}

// ─── Available times ──────────────────────────────────────────────────────────
// Returns up to `limit` upcoming available slots (default 5), formatted for
// display in Eastern time (Caleb's timezone). The date range is capped at 7 days
// to stay within the Calendly API's single-request limit.
export async function getAvailableTimes(
  eventTypeUri: string,
  daysAhead: number,
  limit = 5
): Promise<string[]> {
  const now = new Date();
  const end = new Date(now.getTime() + Math.min(daysAhead, 7) * 86_400_000);

  const url = new URL(`${BASE}/event_type_available_times`);
  url.searchParams.set("event_type", eventTypeUri);
  url.searchParams.set("start_time", now.toISOString());
  url.searchParams.set("end_time", end.toISOString());

  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch availability (${res.status})`);

  const body = (await res.json()) as {
    collection: Array<{ start_time: string; status: string }>;
  };

  return body.collection
    .filter((s) => s.status === "available")
    .slice(0, limit)
    .map((s) =>
      new Date(s.start_time).toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    );
}

// ─── Single-use scheduling link ───────────────────────────────────────────────
// Creates a one-time booking link tied to a specific event type.
// The visitor enters their name and email on Calendly's own page — we
// never handle that data here.
export async function createSchedulingLink(eventTypeUri: string): Promise<string> {
  const res = await fetch(`${BASE}/scheduling_links`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      max_event_count: 1,
      owner: eventTypeUri,
      owner_type: "EventType",
    }),
  });
  if (!res.ok) throw new Error(`Failed to create scheduling link (${res.status})`);
  const body = (await res.json()) as { resource: { booking_url: string } };
  return body.resource.booking_url;
}
