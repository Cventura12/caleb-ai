// PATCH  /api/owner/connectors/[id]  — toggle enabled; update lane (MCP only)
// DELETE /api/owner/connectors/[id]  — remove an MCP connector (built-ins cannot be deleted)
//
// Belt-and-suspenders: proxy.ts already verified the session before this runs,
// but we double-check as required by the owner control panel spec.

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getDb } from "@/lib/db";
import type { Database } from "@/lib/db";

type ConnectorUpdate = Database["public"]["Tables"]["connectors"]["Update"];

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function requireOwner(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionToken(token) : false;
}

export async function PATCH(req: NextRequest, { params }: Context) {
  if (!(await requireOwner(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { enabled, lane } = body as Record<string, unknown>;
  const updates: ConnectorUpdate = {};

  if (typeof enabled === "boolean") updates.enabled = enabled;
  if (lane === "public" || lane === "owner") updates.lane = lane as string;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const db = getDb();
  const { data, error } = await db
    .from("connectors")
    .update(updates)
    .eq("id", id)
    .select(
      "id,type,name,description,tool_names,enabled,lane,mcp_url,credential_masked,created_at"
    )
    .single();

  if (error || !data) {
    console.error("[owner/connectors] PATCH failed:", error);
    return NextResponse.json({ error: "Not found or update failed" }, { status: 404 });
  }

  return NextResponse.json({ connector: data });
}

export async function DELETE(req: NextRequest, { params }: Context) {
  if (!(await requireOwner(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  // Fetch first to confirm it exists and is not a built-in.
  const { data: existing } = await db
    .from("connectors")
    .select("type")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.type === "builtin") {
    return NextResponse.json(
      { error: "Built-in connectors cannot be removed" },
      { status: 403 }
    );
  }

  const { error } = await db.from("connectors").delete().eq("id", id);
  if (error) {
    console.error("[owner/connectors] DELETE failed:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
