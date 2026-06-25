import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { getSession } from "@/lib/services/sessions";
import { generateFollowUpQuestions } from "@/lib/ai/questions";
import { safeJsonParse } from "@/lib/utils";
import type { BasicNeeds } from "@/lib/types";

export const runtime = "nodejs";

// POST /api/ai/questions { session_id } — (re)generate follow-up questions.
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

    const basic = safeJsonParse<BasicNeeds | null>(session.basic_needs_json, null);
    if (!basic) return NextResponse.json({ error: "no_basic_needs" }, { status: 400 });

    const { questions, source } = await generateFollowUpQuestions(basic);

    await supabase.from("ai_questions").delete().eq("session_id", sessionId);
    if (questions.length > 0) {
      await supabase.from("ai_questions").insert(
        questions.map((q) => ({
          session_id: sessionId,
          question_key: q.question_key,
          question_text: q.question_text,
          question_type: q.question_type,
          options_json: q.options ?? null,
          reason_for_question: q.reason ?? null,
          sort_order: q.sort_order,
        })),
      );
    }
    await supabase
      .from("recommendation_sessions")
      .update({ status: "questions_ready" })
      .eq("id", sessionId);

    return NextResponse.json({ questions, source });
  } catch (err) {
    return NextResponse.json(
      { error: "server_error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
