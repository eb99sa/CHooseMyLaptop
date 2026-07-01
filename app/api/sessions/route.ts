import { NextResponse } from "next/server";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { createAnonymousSession } from "@/lib/services/sessions";
import { setSessionCookie } from "@/lib/session";
import { normalizeBasicNeeds } from "@/lib/validation";
import { rateLimitAllowed, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

// POST /api/sessions — create an anonymous session from Page 1 + generate
// follow-up questions, and set the session cookie. No login required.
export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "الخدمة غير مهيأة بعد. حاول لاحقاً." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const basic = normalizeBasicNeeds(body);
  if (!basic) {
    return NextResponse.json(
      { error: "missing_or_invalid_fields", message: "الميزانية ونوع الاستخدام مطلوبان." },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceClient();
    // Wallet guard: this anonymous endpoint fans out to paid LLM calls.
    if (!(await rateLimitAllowed(supabase, `sessions:${clientIp(req)}`, 10, 3600))) {
      return NextResponse.json(
        { error: "rate_limited", message: "محاولات كثيرة. حاول بعد شوي." },
        { status: 429 },
      );
    }
    const { sessionId, token } = await createAnonymousSession(supabase, basic);
    await setSessionCookie(sessionId, token);
    return NextResponse.json({ session_id: sessionId });
  } catch (err) {
    console.error("[api/sessions] error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
