import { NextResponse } from "next/server";
import {
  createAdminToken,
  isAdminConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { clearAdminCookie, setAdminCookie } from "@/lib/admin-cookies";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { rateLimitAllowed, clientIp } from "@/lib/rate-limit";
import { securityEvent } from "@/lib/log";

export const runtime = "nodejs";

// POST /api/admin/login  { password } — verify the shared admin password and
// set a signed, expiring admin cookie.
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const ip = clientIp(req);
  // Brute-force guard on the single shared admin password (8 tries / 10 min / IP).
  if (isDbConfigured() && !(await rateLimitAllowed(createServiceClient(), `admin_login:${ip}`, 8, 600))) {
    securityEvent("rate_limited", { route: "admin_login", ip });
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const password = (body as { password?: unknown })?.password;
  if (!(await verifyAdminPassword(password))) {
    securityEvent("admin_login_failure", { ip });
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await createAdminToken(Date.now());
  await setAdminCookie(token);
  securityEvent("admin_login_success", { ip });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/login — sign out of the admin area.
export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
