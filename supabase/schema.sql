-- Owner control panel: connectors table
-- Run this once in your Supabase project's SQL editor (Database → SQL Editor → New query).

CREATE TABLE IF NOT EXISTS connectors (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 TEXT        NOT NULL CHECK (type IN ('builtin', 'mcp')),
  name                 TEXT        NOT NULL,
  description          TEXT        NOT NULL DEFAULT '',
  -- For builtin: the tool names this connector controls.
  -- For mcp: the tools discovered on the remote MCP server.
  tool_names           TEXT[]      NOT NULL DEFAULT '{}',
  enabled              BOOLEAN     NOT NULL DEFAULT true,
  -- 'public'  → visible to all site visitors
  -- 'owner'   → visible only in owner sessions
  lane                 TEXT        NOT NULL DEFAULT 'owner' CHECK (lane IN ('public', 'owner')),
  -- MCP-only fields
  mcp_url              TEXT,
  -- AES-256-GCM: iv_b64:tag_b64:ciphertext_b64 (colon-separated).
  -- Never sent to the client. Decrypted server-side only when calling the MCP server.
  credential_encrypted TEXT,
  -- Masked preview (e.g. "••••••••abcd") shown in the control panel.
  -- The full credential is never returned to the client after saving.
  credential_masked    TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS. The service role key used server-side bypasses all policies.
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;

-- Seed built-in connectors with stable UUIDs so app-level upserts are idempotent.
INSERT INTO connectors (id, type, name, description, tool_names, enabled, lane)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'builtin',
    'Booking',
    'Let visitors check your Calendly availability and book a meeting.',
    ARRAY['get_availability', 'create_scheduling_link'],
    true,
    'public'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'builtin',
    'Leave a message',
    'Let visitors send a message directly to your inbox via email.',
    ARRAY['leave_message'],
    true,
    'public'
  )
ON CONFLICT (id) DO NOTHING;
