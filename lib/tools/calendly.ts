// Narrowly-scoped Calendly API client.
// Only exposes three operations: read my event types (filtered by slug),
// read available times for that event type, and create a single-use
// scheduling link. No access to existing bookings, invitees, or account data.

const BASE = "https://api.calendly.com";

// ─── Diagnostic helpers (server-side only) ────────────────────────────────────

function logTokenCheck() {
  const token = process.env.CALENDLY_API_TOKEN;
  console.log("[calendly] token present:", !!token, "| length:", token?.length ?? 0);
}

async function loggedFetch(label: string, url: string, init?: RequestInit): Promise<Response> {
  console.log(`[calendly] → ${init?.method ?? "GET"} ${label}`);
  const res = await fetch(url, init);
  console.log(`[calendly] ← ${res.status} ${res.statusText} (${label})`);
  if (!res.ok) {
    let body = "(could not read body)";
    try { body = await res.clone().text(); } catch { /* ignore */ }
    console.error(`[calendly] error body (${label}):`, body);
  }
  return res;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = process.env.CALENDLY_API_TOKEN;
  if (!token) throw new Error("Calendly is not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ─── User URI ─────────────────────────────────────────────────────────────────
// The Calendly PAT is a JWT — user_uuid lives in the payload.
// Decoding it avoids calling GET /users/me, which requires the users:read scope
// that Personal Access Tokens don't include by default.
export function getMyUri(): string {
  logTokenCheck();
  const token = process.env.CALENDLY_API_TOKEN;
  if (!token) throw new Error("Calendly is not configured");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("CALENDLY_API_TOKEN is not a valid JWT");

  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8")
  ) as { user_uuid?: string };

  if (!payload.user_uuid) throw new Error("Token payload missing user_uuid claim");

  const uri = `${BASE}/users/${payload.user_uuid}`;
  console.log("[calendly] user URI from token:", uri);
  return uri;
}

// ─── Event type ───────────────────────────────────────────────────────────────
export interface CalendlyEventType {
  uri: string;
  name: string;
  duration: number;
}

export async function getEventType(userUri: string): Promise<CalendlyEventType | null> {
  const slug = process.env.CALENDLY_EVENT_SLUG ?? "30min";
  console.log("[calendly] looking for event type slug:", slug);

  const url = new URL(`${BASE}/event_types`);
  url.searchParams.set("user", userUri);
  url.searchParams.set("active", "true");
  url.searchParams.set("count", "100");

  const res = await loggedFetch("event_types", url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch event types (${res.status})`);

  const body = (await res.json()) as {
    collection: Array<{ uri: string; name: string; duration: number; slug: string; active: boolean }>;
  };

  console.log(
    "[calendly] event types found:",
    body.collection.map((et) => `${et.slug} (active=${et.active})`).join(", ") || "(none)"
  );

  const match = body.collection.find((et) => et.slug === slug && et.active);
  if (!match) {
    console.warn(`[calendly] no active event type with slug "${slug}"`);
    return null;
  }
  console.log("[calendly] matched event type:", match.name, "| duration:", match.duration);
  return { uri: match.uri, name: match.name, duration: match.duration };
}

// ─── Available times ──────────────────────────────────────────────────────────
export async function getAvailableTimes(
  eventTypeUri: string,
  daysAhead: number,
  limit = 5
): Promise<string[]> {
  // Calendly requires start_time to be in the future — use a 5-min buffer.
  const start = new Date(Date.now() + 5 * 60_000);
  const end = new Date(start.getTime() + Math.min(daysAhead, 7) * 86_400_000);

  const url = new URL(`${BASE}/event_type_available_times`);
  url.searchParams.set("event_type", eventTypeUri);
  url.searchParams.set("start_time", start.toISOString());
  url.searchParams.set("end_time", end.toISOString());

  const res = await loggedFetch("event_type_available_times", url.toString(), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch availability (${res.status})`);

  const body = (await res.json()) as {
    collection: Array<{ start_time: string; status: string }>;
  };

  const available = body.collection.filter((s) => s.status === "available");
  console.log("[calendly] available slots total:", available.length, "| returning:", Math.min(available.length, limit));

  return available
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
export async function createSchedulingLink(eventTypeUri: string): Promise<string> {
  const res = await loggedFetch("scheduling_links", `${BASE}/scheduling_links`, {
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
  console.log("[calendly] scheduling link created successfully");
  return body.resource.booking_url;
}
