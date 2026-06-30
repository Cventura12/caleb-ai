-- Run this in Supabase SQL Editor after migrations.sql.
-- Adds: owner action log.

CREATE TABLE IF NOT EXISTS owner_actions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action     TEXT        NOT NULL,   -- e.g. 'toggle_connector', 'set_connector_lane'
  details    JSONB                   -- what changed
);
ALTER TABLE owner_actions ENABLE ROW LEVEL SECURITY;
