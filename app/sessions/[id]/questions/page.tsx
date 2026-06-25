import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { FollowUpForm } from "@/components/forms/FollowUpForm";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { UI } from "@/lib/i18n";
import type { AIQuestion, AnswerType } from "@/lib/types";

// PAGE 2 — AI follow-up questions (server shell).
export default async function QuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();

  // RLS restricts to the owner; maybeSingle gives null instead of throwing.
  const { data: session } = await supabase
    .from("recommendation_sessions")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!session) redirect("/dashboard");

  const { data: rows } = await supabase
    .from("ai_questions")
    .select("question_key, question_text, question_type, options_json, reason_for_question, sort_order")
    .eq("session_id", id)
    .order("sort_order", { ascending: true });

  const questions: AIQuestion[] = (rows ?? []).map((row) => ({
    question_key: row.question_key as string,
    question_text: row.question_text as string,
    question_type: (row.question_type as AnswerType) ?? "text",
    options: row.options_json ?? undefined,
    reason: row.reason_for_question ?? undefined,
    sort_order: (row.sort_order as number) ?? 0,
  }));

  return (
    <>
      <SiteHeader email={user.email} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <ProgressSteps current={2} steps={["احتياجاتك", "أسئلة المتابعة"]} />
        </div>

        <div className="mb-6 animate-fadeup">
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">{UI.followUpTitle}</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
            {UI.followUpSubtitle}
          </p>
        </div>

        <FollowUpForm sessionId={id} questions={questions} />
      </main>
    </>
  );
}
