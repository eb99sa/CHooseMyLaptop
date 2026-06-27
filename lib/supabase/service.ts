import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client. SERVER ONLY — bypasses RLS.
// This is the ONLY way the app touches the database: the browser never talks to
// Supabase directly. All access goes through server API routes / server
// components that call this. Never import into a client component.

/** True when the server DB credentials are present. */
export function isDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
