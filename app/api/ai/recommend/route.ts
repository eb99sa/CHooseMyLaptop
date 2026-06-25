import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { getSession, runRecommendation } from "@/lib/services/sessions";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/ai/recommend { session_id } — (re)build the recommendation report
// for a session whose answers are already stored.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { session_id?: string };
  try {
    body = (await req.json()) as { session_id?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = body.session_id;
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const session = await getSession(supabase, sessionId);
    if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const report = await runRecommendation(supabase, sessionId, user.id);
    return NextResponse.json({ ok: true, source: report.source });
  } catch (err) {
    return NextResponse.json(
      { error: "server_error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
