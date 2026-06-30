// Server-side Supabase client using the service role key.
// NEVER import this from a client component.
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser.

import { createClient } from "@supabase/supabase-js";

// Minimal schema type for the connectors table.
// Keeps Supabase query builder fully typed without running codegen.
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
