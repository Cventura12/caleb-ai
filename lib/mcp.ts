// MCP (Model Context Protocol) client helpers — server-side only.
// Connects to remote MCP servers, lists their tools, and proxies calls.
// The browser never talks to an MCP server. Credentials are decrypted here,
// used immediately for the HTTP call, and never held past the request.
//
// Note: visitor-triggered tools (lane="public") should be scoped to least
// privilege at the credential level — the credential itself limits blast radius.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ToolDefinition, ToolExecutionContext, Lane } from "./tools/registry";
import type { ConnectorRow } from "./connectors";
import { decryptCredential } from "./crypto";

function buildHeaders(connector: ConnectorRow): Record<string, string> {
  const headers: Record<string, string> = {};
  if (connector.credential_encrypted) {
    headers["Authorization"] = `Bearer ${decryptCredential(connector.credential_encrypted)}`;
  }
  return headers;
}

async function connectAndList(
  url: string,
  headers: Record<string, string>
): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers },
  });
  const client = new Client({ name: "caleb-ai", version: "1.0.0" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  await client.close();
  return tools ?? [];
}

// Builds ToolDefinitions that proxy to a remote MCP server.
// Returns [] if the connection fails or the caller's lane doesn't permit access.
export async function buildMcpTools(
  connector: ConnectorRow,
  callerLane: Lane
): Promise<ToolDefinition[]> {
  // Lane gate: owner-only connectors are invisible in public sessions.
  if (connector.lane === "owner" && callerLane !== "owner") return [];

  const headers = buildHeaders(connector);
  let remoteTools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }> = [];

  try {
    remoteTools = await connectAndList(connector.mcp_url!, headers);
  } catch (err) {
    console.error(`[mcp] "${connector.name}" list-tools failed:`, err);
    return [];
  }

  return remoteTools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? tool.name,
    input_schema: (tool.inputSchema as ToolDefinition["input_schema"]) ?? {
      type: "object",
      properties: {},
      required: [],
    },
    lane: connector.lane,
    statusLabel: `${tool.name.replace(/_/g, " ")}…`,
    execute: async (input: Record<string, unknown>, _ctx: ToolExecutionContext) => {
      // Re-derive headers on every call — never close over a decrypted credential.
      const callHeaders = buildHeaders(connector);
      const transport = new StreamableHTTPClientTransport(
        new URL(connector.mcp_url!),
        { requestInit: { headers: callHeaders } }
      );
      const c = new Client({ name: "caleb-ai", version: "1.0.0" });
      await c.connect(transport);
      const res = await c.callTool({ name: tool.name, arguments: input });
      await c.close();

      // Flatten text content blocks; fall back to raw JSON.
      type ContentBlock = { type: string; text?: string };
      const raw = res.content;
      const content: ContentBlock[] = Array.isArray(raw) ? (raw as ContentBlock[]) : [];
      const text = content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n");
      return text || JSON.stringify(res);
    },
  }));
}

// Probes a server and returns its tool names — used at connector registration time
// to populate the tool_names column without duplicating client setup logic.
export async function probeMcpTools(
  url: string,
  credential?: string
): Promise<string[]> {
  const headers: Record<string, string> = {};
  if (credential) headers["Authorization"] = `Bearer ${credential}`;
  const tools = await connectAndList(url, headers);
  return tools.map((t) => t.name);
}
