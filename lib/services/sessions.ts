import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BasicNeeds,
  FinalReport,
  RecommendationSessionRow,
  ScoredLaptop,
  UserAnswer,
} from "@/lib/types";
import { generateFollowUpQuestions } from "@/lib/ai/questions";
import { buildRecommendation } from "@/lib/ai/recommend";
import { fetchAllListings } from "@/lib/data/listings";
import { safeJsonParse } from "@/lib/utils";

// Service layer: orchestrates DB + AI. Routes stay thin and just handle
// auth + request parsing. All calls use the request-scoped (RLS-enforced)
// Supabase client unless noted.

async function logEvent(
  supabase: SupabaseClient,
  userId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Best-effort analytics; never block the main flow on it.
  try {
    await supabase.from("admin_analytics_events").insert({
      user_id: userId,
      event_type: eventType,
      event_payload: payload,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Create a session from Page 1 answers and immediately generate Page 2
 * follow-up questions. Returns the new session id.
 */
export async function createSessionWithQuestions(
  supabase: SupabaseClient,
  userId: string,
  basic: BasicNeeds,
): Promise<{ sessionId: string }> {
  const { data: session, error } = await supabase
    .from("recommendation_sessions")
    .insert({
      user_id: userId,
      status: "draft",
      budget_min: basic.budget_min,
      budget_max: basic.budget_max,
      currency: basic.currency,
      country: basic.country,
      city: basic.city,
      primary_use_case: basic.primary_use_case,
      basic_needs_json: basic,
    })
    .select("id")
    .single();

  if (error || !session) {
    throw new Error(`Could not create session: ${error?.message ?? "unknown"}`);
  }

  const sessionId = session.id as string;
  const { questions } = await generateFollowUpQuestions(basic);

  if (questions.length > 0) {
    const rows = questions.map((q) => ({
      session_id: sessionId,
      question_key: q.question_key,
      question_text: q.question_text,
      question_type: q.question_type,
      options_json: q.options ?? null,
      reason_for_question: q.reason ?? null,
      sort_order: q.sort_order,
    }));
    await supabase.from("ai_questions").insert(rows);
  }

  await supabase
    .from("recommendation_sessions")
    .update({ status: "questions_ready" })
    .eq("id", sessionId);

  await logEvent(supabase, userId, "session_created", {
    use_case: basic.primary_use_case,
    budget_min: basic.budget_min,
    budget_max: basic.budget_max,
    currency: basic.currency,
  });

  return { sessionId };
}

/** Fetch one session (RLS guarantees the caller owns it). */
export async function getSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<RecommendationSessionRow | null> {
  const { data } = await supabase
    .from("recommendation_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  return (data as RecommendationSessionRow | null) ?? null;
}

/** Replace stored Page 2 answers for a session. */
export async function saveAnswers(
  supabase: SupabaseClient,
  sessionId: string,
  answers: UserAnswer[],
): Promise<void> {
  await supabase.from("user_answers").delete().eq("session_id", sessionId);
  if (answers.length > 0) {
    const rows = answers.map((a) => ({
      session_id: sessionId,
      question_key: a.question_key,
      question_text: a.question_text,
      answer_value: a.answer_value,
      answer_type: a.answer_type,
    }));
    await supabase.from("user_answers").insert(rows);
  }
  await supabase
    .from("recommendation_sessions")
    .update({ status: "answered" })
    .eq("id", sessionId);
}

function resultRows(sessionId: string, report: FinalReport) {
  const rows: Array<Record<string, unknown>> = [];
  const add = (type: string, s?: ScoredLaptop, reasoning?: string) => {
    if (!s) return;
    rows.push({
      session_id: sessionId,
      laptop_listing_id: s.listing.id,
      fit_score: s.fit_score,
      roi_score: s.roi_score,
      final_score: s.final_score,
      recommendation_type: type,
      reasoning: reasoning ?? s.reasons.join(" "),
      warnings_json: s.warnings,
    });
  };
  add("best_overall", report.best_overall);
  add("best_budget", report.best_budget);
  add("best_value", report.best_value);
  add("avoid", report.avoid, report.avoid?.warnings.join(" "));
  return rows;
}

/**
 * Build (or rebuild) the recommendation report for a session. Reads basic
 * needs + stored answers + the catalog, runs the engine, persists spec/report
 * and normalized result rows, and returns the report.
 */
export async function runRecommendation(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string | null,
): Promise<FinalReport> {
  const session = await getSession(supabase, sessionId);
  if (!session) throw new Error("Session not found");

  const basic = safeJsonParse<BasicNeeds | null>(session.basic_needs_json, null);
  if (!basic) throw new Error("Session is missing basic needs data");

  const { data: answerRows } = await supabase
    .from("user_answers")
    .select("question_key, question_text, answer_value, answer_type")
    .eq("session_id", sessionId);

  const answers: UserAnswer[] = (answerRows ?? []).map((r) => ({
    question_key: r.question_key,
    question_text: r.question_text ?? "",
    answer_value: r.answer_value ?? "",
    answer_type: (r.answer_type ?? "text") as UserAnswer["answer_type"],
  }));

  const listings = await fetchAllListings(supabase);

  let report: FinalReport;
  try {
    report = await buildRecommendation(basic, answers, listings);
  } catch (err) {
    await supabase
      .from("recommendation_sessions")
      .update({ status: "failed" })
      .eq("id", sessionId);
    await logEvent(supabase, userId, "recommendation_failed", {
      error: (err as Error).message,
    });
    throw err;
  }

  // Persist the full report + spec on the session, and normalized result rows.
  await supabase
    .from("recommendation_sessions")
    .update({
      status: "completed",
      spec_json: report.spec,
      report_json: report,
    })
    .eq("id", sessionId);

  await supabase.from("recommendation_results").delete().eq("session_id", sessionId);
  const rows = resultRows(sessionId, report);
  if (rows.length > 0) {
    await supabase.from("recommendation_results").insert(rows);
  }

  await logEvent(supabase, userId, "recommendation_completed", {
    use_case: basic.primary_use_case,
    source: report.source,
    top_model: report.best_overall?.listing.product_title ?? null,
    top_score: report.best_overall?.final_score ?? null,
  });

  return report;
}
