"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client (uses the public anon key).
// Safe to call from client components.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
