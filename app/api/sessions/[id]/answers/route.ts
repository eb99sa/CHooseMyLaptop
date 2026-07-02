import { NextResponse } from "next/server";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { getSessionForViewer, saveAnswersAndRecommend } from "@/lib/services/sessions";
import { normalizeAnswers } from "@/lib/validation";
import { rateLimitAllowed, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/sessions/[id]/answers — store Page 2 answers and build the report.
// Ownership is proven by the session cookie token (no accounts).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "الخدمة غير مهيأة بعد." },
      { status: 503 },
    );
  }

  const { id: sessionId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const answers = normalizeAnswers(body);

  // Verify this browser owns the session (cookie token must match the hash).
  const session = await getSessionForViewer(sessionId);
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const supabase = createServiceClient();
    // Wallet guard: /answers can re-run the paid pipeline; cap per IP (the
    // idempotency short-circuit already blocks re-runs on a completed session).
    if (!(await rateLimitAllowed(supabase, `answers:${clientIp(req)}`, 30, 3600))) {
      return NextResponse.json(
        { error: "rate_limited", message: "محاولات كثيرة. حاول بعد شوي." },
        { status: 429 },
      );
    }
    const report = await saveAnswersAndRecommend(supabase, sessionId, answers);
    return NextResponse.json({ ok: true, session_id: sessionId, source: report.source });
  } catch (err) {
    console.error("[api/answers] error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
