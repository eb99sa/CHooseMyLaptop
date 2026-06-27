import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { FollowUpForm } from "@/components/forms/FollowUpForm";
import { getSessionForViewer } from "@/lib/services/sessions";
import { UI } from "@/lib/i18n";
import type { AIQuestion } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

// PAGE 2 — AI follow-up questions (anonymous server shell). Resolves the session
// for the current browser via the session cookie; null means missing, expired,
// or not owned by this browser, so we send the visitor back to start over.
export default async function QuestionsPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getSessionForViewer(id);
  if (!session) redirect("/sessions/new");

  const questions: AIQuestion[] = session.ai_followup_questions_json ?? [];

  return (
    <>
      <SiteHeader />
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
