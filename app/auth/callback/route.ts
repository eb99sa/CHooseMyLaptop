import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /auth/callback — exchange the magic-link code for a session, then redirect.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const candidate = searchParams.get("next") || "/dashboard";

  // Only allow internal paths: a single leading slash, NOT "//host" or "/\host"
  // (both normalize to off-origin in browsers — classic open-redirect vector).
  const safeNext = /^\/(?![/\\])/.test(candidate) ? candidate : "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = new URL(safeNext, origin);
      // Defense-in-depth: never redirect off the app's own origin.
      return NextResponse.redirect(
        dest.origin === origin ? dest : new URL("/dashboard", origin),
      );
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
}
