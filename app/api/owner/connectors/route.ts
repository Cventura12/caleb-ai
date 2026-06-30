// GET  /api/owner/connectors  — list all connectors (no credentials in response)
// POST /api/owner/connectors  — register a new MCP connector
//
// Belt-and-suspenders: proxy.ts already verified the session before this handler runs,
// but we double-check here as the spec requires every /api/owner/** route to enforce
// the owner session independently.

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { listConnectors } from "@/lib/connectors";
import { encryptCredential, maskCredential } from "@/lib/crypto";
import { probeMcpTools } from "@/lib/mcp";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

async function requireOwner(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? await verifySessionToken(token) : false;
}

export async function GET(req: NextRequest) {
  if (!(await requireOwner(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connectors = await listConnectors();
    return NextResponse.json({ connectors });
  } catch (err) {
    console.error("[owner/connectors] GET failed:", err);
    return NextResponse.json({ error: "Failed to load connectors" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireOwner(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, mcp_url, credential, lane } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof mcp_url !== "string" || !mcp_url.trim()) {
    return NextResponse.json({ error: "mcp_url is required" }, { status: 400 });
  }
  if (lane !== "public" && lane !== "owner") {
    return NextResponse.json(
      { error: "lane must be 'public' or 'owner'" },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(mcp_url.trim());
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ error: "mcp_url must be a valid http/https URL" }, { status: 400 });
  }

  // Connect to the MCP server and discover its tools.
  let toolNames: string[] = [];
  try {
    const rawCredential = typeof credential === "string" ? credential : undefined;
    toolNames = await probeMcpTools(parsedUrl.toString(), rawCredential);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not connect to MCP server: ${msg}` },
      { status: 422 }
    );
  }

  // Encrypt credential at rest.
  const rawCred = typeof credential === "string" && credential ? credential : null;
  const credentialEncrypted = rawCred ? encryptCredential(rawCred) : null;
  const credentialMasked = rawCred ? maskCredential(rawCred) : null;

  const db = getDb();
  const { data, error: dbErr } = await db
    .from("connectors")
    .insert({
      type: "mcp",
      name: name.trim(),
      description: `MCP connector at ${parsedUrl.hostname}`,
      tool_names: toolNames,
      enabled: true,
      lane,
      mcp_url: parsedUrl.toString(),
      credential_encrypted: credentialEncrypted,
      credential_masked: credentialMasked,
    })
    .select(
      "id,type,name,description,tool_names,enabled,lane,mcp_url,credential_masked,created_at"
    )
    .single();

  if (dbErr || !data) {
    console.error("[owner/connectors] POST insert failed:", dbErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ connector: data }, { status: 201 });
}
