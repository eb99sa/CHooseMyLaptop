import { NextResponse } from "next/server";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { getSessionForViewer, saveAnswersAndRecommend } from "@/lib/services/sessions";
import { normalizeAnswers } from "@/lib/validation";

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
    const report = await saveAnswersAndRecommend(supabase, sessionId, answers);
    return NextResponse.json({ ok: true, session_id: sessionId, source: report.source });
  } catch (err) {
    return NextResponse.json(
      { error: "server_error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
