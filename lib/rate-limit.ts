import type { SupabaseClient } from "@supabase/supabase-js";

// Best-effort client IP from the platform proxy headers (Vercel sets
// x-forwarded-for). Used only as a rate-limit key, never for auth.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Fixed-window rate limit via the Postgres `check_rate_limit` RPC
 * (supabase/rate-limit.sql). Returns true when the request is ALLOWED.
 *
 * Fails OPEN (allows) on any error — a missing migration or DB blip must not
 * take down the anonymous flow. The wallet guard is one layer among several
 * (per-call token caps + hard timeouts still bound each request); when the SQL
 * is applied it becomes effective. Errors are logged so a mis-config is visible.
 */
export async function rateLimitAllowed(
  supabase: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.warn("[rate-limit] rpc error, failing open:", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.warn("[rate-limit] threw, failing open:", (e as Error).message);
    return true;
  }
}
