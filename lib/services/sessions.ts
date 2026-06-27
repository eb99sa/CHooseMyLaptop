import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnonymousSessionRow,
  BasicNeeds,
  FinalReport,
  UserAnswer,
} from "@/lib/types";
import { generateFollowUpQuestions } from "@/lib/ai/questions";
import { buildRecommendation } from "@/lib/ai/recommend";
import { fetchAllListings } from "@/lib/data/listings";
import { createServiceClient } from "@/lib/supabase/service";
import {
  hashSessionToken,
  newSessionToken,
  readSessionCookie,
} from "@/lib/session";

const TABLE = "anonymous_recommendation_sessions";

// Service layer for ANONYMOUS sessions. There are no user accounts: a session
// is owned by whoever holds its raw token (stored in an HTTP-only cookie). All
// calls use the service-role client; access control is enforced by verifying the
// token hash, NOT by RLS.

async function logEvent(
  supabase: SupabaseClient,
  sessionId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("admin_analytics_events").insert({
      anonymous_session_id: sessionId,
      event_type: eventType,
      event_payload: payload,
    });
  } catch {
    /* best-effort analytics; never block the flow */
  }
}

/**
 * Create an anonymous session from Page 1 answers and generate follow-up
 * questions. Returns the new id and the raw token (the caller sets the cookie).
 */
export async function createAnonymousSession(
  supabase: SupabaseClient,
  basic: BasicNeeds,
): Promise<{ sessionId: string; token: string }> {
  const token = newSessionToken();
  const tokenHash = await hashSessionToken(token);
  const { questions } = await generateFollowUpQuestions(basic);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      session_token_hash: tokenHash,
      status: "questions_ready",
      budget_min: basic.budget_min,
      budget_max: basic.budget_max,
      currency: basic.currency,
      country: basic.country || null,
      city_or_area: basic.city_or_area || null,
      location_source: basic.location_source,
      primary_use_case: basic.primary_use_case,
      basic_needs_json: basic,
      ai_followup_questions_json: questions,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Could not create session: ${error?.message ?? "unknown"}`);
  }

  const sessionId = data.id as string;
  await logEvent(supabase, sessionId, "session_created", {
    use_case: basic.primary_use_case,
    budget_min: basic.budget_min,
    budget_max: basic.budget_max,
    currency: basic.currency,
    location_source: basic.location_source,
    country: basic.country || null,
    city_or_area: basic.city_or_area || null,
  });

  return { sessionId, token };
}

export async function getSessionById(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<AnonymousSessionRow | null> {
  const { data } = await supabase.from(TABLE).select("*").eq("id", sessionId).maybeSingle();
  return (data as AnonymousSessionRow | null) ?? null;
}

function isExpired(row: AnonymousSessionRow): boolean {
  const exp = new Date(row.expires_at).getTime();
  return Number.isFinite(exp) && exp <= Date.now();
}

/** Verify that the raw token matches the row's stored hash. */
export async function tokenMatches(row: AnonymousSessionRow, token: string): Promise<boolean> {
  const hash = await hashSessionToken(token);
  return hash === row.session_token_hash;
}

/**
 * Resolve the session for the current browser: reads the session cookie and
 * returns the row only if it belongs to `sessionId`, the token matches, and it
 * hasn't expired. Used by server components (report/questions/compare) and by
 * the answers route. Returns null otherwise.
 */
export async function getSessionForViewer(
  sessionId: string,
): Promise<AnonymousSessionRow | null> {
  const cookie = await readSessionCookie();
  if (!cookie || cookie.sessionId !== sessionId) return null;
  const supabase = createServiceClient();
  const row = await getSessionById(supabase, sessionId);
  if (!row || isExpired(row)) return null;
  if (!(await tokenMatches(row, cookie.token))) return null;
  return row;
}

/**
 * Save Page 2 answers and build the recommendation report. Assumes the caller
 * has already verified token ownership of `sessionId`.
 */
export async function saveAnswersAndRecommend(
  supabase: SupabaseClient,
  sessionId: string,
  answers: UserAnswer[],
): Promise<FinalReport> {
  await supabase
    .from(TABLE)
    .update({ answers_json: answers, status: "answered" })
    .eq("id", sessionId);

  const session = await getSessionById(supabase, sessionId);
  if (!session) throw new Error("Session not found");
  return runRecommendation(supabase, session);
}

/**
 * Build (or rebuild) the report for a session from its stored basic needs +
 * answers + the catalog, persist it, and return it.
 */
export async function runRecommendation(
  supabase: SupabaseClient,
  session: AnonymousSessionRow,
): Promise<FinalReport> {
  const basic = session.basic_needs_json;
  if (!basic) throw new Error("Session is missing basic needs data");
  const answers: UserAnswer[] = Array.isArray(session.answers_json)
    ? session.answers_json
    : [];

  const listings = await fetchAllListings(supabase, { country: basic.country });

  let report: FinalReport;
  try {
    report = await buildRecommendation(basic, answers, listings);
  } catch (err) {
    await supabase.from(TABLE).update({ status: "failed" }).eq("id", session.id);
    await logEvent(supabase, session.id, "recommendation_failed", {
      error: (err as Error).message,
    });
    throw err;
  }

  await supabase
    .from(TABLE)
    .update({
      status: "completed",
      recommended_specs_json: report.spec,
      recommendation_result_json: report,
    })
    .eq("id", session.id);

  await logEvent(supabase, session.id, "recommendation_completed", {
    use_case: basic.primary_use_case,
    source: report.source,
    top_model: report.best_overall?.listing.product_title ?? null,
    top_score: report.best_overall?.final_score ?? null,
  });

  return report;
}
