import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { USE_CASE_LABELS } from "@/lib/i18n";
import type { RecommendationSessionRow, SessionStatus, UseCase } from "@/lib/types";
import { formatDate, formatPrice } from "@/lib/utils";

interface SessionCardProps {
  session: RecommendationSessionRow;
}

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

// Map a session status to an Arabic label + a Badge tone.
const STATUS_META: Record<SessionStatus, { label: string; tone: Tone }> = {
  completed: { label: "اكتملت", tone: "success" },
  questions_ready: { label: "قيد الإكمال", tone: "brand" },
  answered: { label: "قيد الإكمال", tone: "brand" },
  draft: { label: "مسودة", tone: "neutral" },
  failed: { label: "فشلت", tone: "danger" },
};

// Presentational server component: one row from recommendation_sessions.
export function SessionCard({ session }: SessionCardProps) {
  const status = STATUS_META[session.status] ?? STATUS_META.draft;

  const useCaseLabel =
    session.primary_use_case && session.primary_use_case in USE_CASE_LABELS
      ? USE_CASE_LABELS[session.primary_use_case as UseCase]
      : "توصية لابتوب";

  const hasBudget = session.budget_min != null && session.budget_max != null;
  const currency = session.currency ?? "KWD";
  const budgetText = hasBudget
    ? `${formatPrice(session.budget_min as number, currency)} - ${formatPrice(
        session.budget_max as number,
        currency,
      )}`
    : null;

  const locationParts = [session.city, session.country].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join("، ") : null;

  const isCompleted = session.status === "completed";
  const actionHref = isCompleted
    ? `/sessions/${session.id}/report`
    : `/sessions/${session.id}/questions`;
  const actionLabel = isCompleted ? "عرض التقرير" : "أكمل الأسئلة";

  return (
    <Card className="flex flex-col gap-4 animate-fadeup">
      <div className="flex items-start justify-between gap-3">
        <CardTitle className="text-base">{useCaseLabel}</CardTitle>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        {budgetText && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--color-muted)]">الميزانية</dt>
            <dd className="font-medium text-[var(--color-ink)]">{budgetText}</dd>
          </div>
        )}
        {locationText && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--color-muted)]">الموقع</dt>
            <dd className="font-medium text-[var(--color-ink)]">{locationText}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[var(--color-muted)]">التاريخ</dt>
          <dd className="font-medium text-[var(--color-ink)]">
            {formatDate(session.created_at)}
          </dd>
        </div>
      </dl>

      <Link href={actionHref} className="btn btn-primary mt-auto w-full text-sm">
        {actionLabel}
      </Link>
    </Card>
  );
}
