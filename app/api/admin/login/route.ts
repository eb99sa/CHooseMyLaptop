import { NextResponse } from "next/server";
import {
  createAdminToken,
  isAdminConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { clearAdminCookie, setAdminCookie } from "@/lib/admin-cookies";

export const runtime = "nodejs";

// POST /api/admin/login  { password } — verify the shared admin password and
// set a signed, expiring admin cookie.
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const password = (body as { password?: unknown })?.password;
  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await createAdminToken(Date.now());
  await setAdminCookie(token);
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/login — sign out of the admin area.
export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
