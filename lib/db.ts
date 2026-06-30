// Server-side Supabase client using the service role key.
// NEVER import this from a client component.
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser.

import { createClient } from "@supabase/supabase-js";

// Minimal schema types — keeps the query builder typed without running codegen.
export type Database = {
  public: {
    Tables: {
      connectors: {
        Row: {
          id: string;
          type: string;
          name: string;
          description: string;
          tool_names: string[];
          enabled: boolean;
          lane: string;
          mcp_url: string | null;
          credential_encrypted: string | null;
          credential_masked: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          name: string;
          description?: string;
          tool_names?: string[];
          enabled?: boolean;
          lane?: string;
          mcp_url?: string | null;
          credential_encrypted?: string | null;
          credential_masked?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          name?: string;
          description?: string;
          tool_names?: string[];
          enabled?: boolean;
          lane?: string;
          mcp_url?: string | null;
          credential_encrypted?: string | null;
          credential_masked?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limit_buckets: {
        Row: { key: string; count: number; window_start: string };
        Insert: { key: string; count?: number; window_start?: string };
        Update: { key?: string; count?: number; window_start?: string };
        Relationships: [];
      };
      visitor_log: {
        Row: {
          id: string;
          created_at: string;
          session_id: string;
          gate_answer: string | null;
          first_message: string;
          action: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          session_id: string;
          gate_answer?: string | null;
          first_message: string;
          action?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          session_id?: string;
          gate_answer?: string | null;
          first_message?: string;
          action?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_window_seconds: number; p_max: number };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let _client: ReturnType<typeof createClient<Database>> | null = null;

export function isDbConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getDb() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}
