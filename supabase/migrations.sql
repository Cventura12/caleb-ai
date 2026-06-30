-- Run this in Supabase SQL Editor after schema.sql.
-- Adds: durable rate limiting, visitor log.

-- ── Rate limiting ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key          TEXT        PRIMARY KEY,
  count        INTEGER     NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Atomic fixed-window rate-limit check + increment.
-- Returns TRUE if the caller is within the limit, FALSE if over.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key            TEXT,
  p_window_seconds INTEGER,
  p_max            INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  -- Align to window boundary (floor to nearest p_window_seconds)
  v_window_start := to_timestamp(
    (EXTRACT(EPOCH FROM NOW())::BIGINT / p_window_seconds) * p_window_seconds
  );

  INSERT INTO rate_limit_buckets (key, count, window_start)
  VALUES (p_key, 1, v_window_start)
  ON CONFLICT (key) DO UPDATE
    SET
      count = CASE
                WHEN rate_limit_buckets.window_start < v_window_start
                  THEN 1            -- new window: reset
                ELSE rate_limit_buckets.count + 1
              END,
      window_start = GREATEST(rate_limit_buckets.window_start, v_window_start)
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- ── Visitor log ────────────────────────────────────────────────────────────────
-- Stores lightweight per-session metadata. No sensitive data.
CREATE TABLE IF NOT EXISTS visitor_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id    TEXT        NOT NULL,
  gate_answer   TEXT,                      -- what the visitor typed at the gate
  first_message TEXT        NOT NULL,      -- truncated to 500 chars
  action        TEXT                       -- 'booked' | 'messaged' | NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS visitor_log_session_idx ON visitor_log(session_id);
ALTER TABLE visitor_log ENABLE ROW LEVEL SECURITY;
