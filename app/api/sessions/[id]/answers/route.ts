import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { getSession, runRecommendation, saveAnswers } from "@/lib/services/sessions";
import { normalizeAnswers } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/sessions/[id]/answers — store Page 2 answers and build the report.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const answers = normalizeAnswers(body);

  try {
    const supabase = await createSupabaseServerClient();

    // RLS already restricts to the owner; this gives a clean 404 if not found.
    const session = await getSession(supabase, sessionId);
    if (!session) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await saveAnswers(supabase, sessionId, answers);
    const report = await runRecommendation(supabase, sessionId, user.id);

    return NextResponse.json({ ok: true, session_id: sessionId, source: report.source });
  } catch (err) {
    return NextResponse.json(
      { error: "server_error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
