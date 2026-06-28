import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionForViewer } from "@/lib/services/sessions";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Card, CardTitle, CardMuted } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LaptopCard } from "@/components/report/LaptopCard";
import { SpecBlock } from "@/components/report/SpecBlock";
import { RECOMMENDATION_TYPE_LABELS, UI } from "@/lib/i18n";
import { formatPrice, safeJsonParse } from "@/lib/utils";
import type { FinalReport } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Recommendation report — anonymous server component. Reads the session for the
// current browser, parses the FinalReport, and lays out summary, specs, price,
// picks, options, and narrative.
export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getSessionForViewer(id);
  if (!session) redirect("/sessions/new");

  if (session.status !== "completed" || !session.recommendation_result_json) {
    redirect(`/sessions/${id}/questions`);
  }

  const report = safeJsonParse<FinalReport | null>(
    session.recommendation_result_json,
    null,
  );
  if (!report || !report.spec || !report.scored) {
    redirect(`/sessions/${id}/questions`);
  }

  const { spec, scored } = report;
  const hasSeed = scored.some((s) => s.listing.source_type === "seed");
  const isEstimated = report.source === "fallback" || hasSeed;
  const locationSkipped = session.location_source === "skipped";

  // Curated picks, de-duplicated by listing id so the same laptop is never
  // shown as two separate "final recommendation" cards (small catalogs).
  const seenPickIds = new Set<string>();
  const picks = [
    { key: "best_overall", scored: report.best_overall },
    { key: "best_value", scored: report.best_value },
    { key: "best_budget", scored: report.best_budget },
  ].filter((p) => {
    if (!p.scored || seenPickIds.has(p.scored.listing.id)) return false;
    seenPickIds.add(p.scored.listing.id);
    return true;
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="animate-fadeup space-y-8">
          {/* Header */}
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
                {UI.reportTitle}
              </h1>
              {isEstimated && <Badge tone="warning">{UI.estimatedBadge}</Badge>}
            </div>
            {isEstimated && (
              <CardMuted className="max-w-3xl">{UI.estimatedNote}</CardMuted>
            )}
            {locationSkipped && (
              <CardMuted className="max-w-3xl">{UI.nearbyNeedsLocation}</CardMuted>
            )}
          </header>

          {/* 1) Need summary */}
          <Card className="space-y-2">
            <CardTitle>{UI.needSummary}</CardTitle>
            <p className="text-sm leading-relaxed text-[var(--color-ink)] sm:text-base">
              {spec.need_summary}
            </p>
          </Card>

          {/* 2) Recommended specs */}
          <Card className="space-y-4">
            <CardTitle>{UI.recommendedSpecs}</CardTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <SpecBlock title={UI.minimumSpecs} target={spec.spec_range.minimum} />
              <SpecBlock
                title={UI.idealSpecs}
                target={spec.spec_range.ideal}
                tone="brand"
              />
            </div>
            {spec.spec_range.unnecessary.length > 0 && (
              <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-canvas)] p-4">
                <p className="mb-2 text-sm font-bold text-[var(--color-ink)]">
                  {UI.unnecessarySpecs}
                </p>
                <ul className="space-y-1">
                  {spec.spec_range.unnecessary.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm text-[var(--color-muted)]"
                    >
                      <span className="mt-0.5 shrink-0 text-[var(--color-success)]" aria-hidden>
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* 3) Price range */}
          <Card className="space-y-4">
            <CardTitle>{UI.priceRange}</CardTitle>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[var(--color-brand-700)]">
                {formatPrice(spec.price_range.fair_min, spec.price_range.currency)}
              </span>
              <span className="text-[var(--color-muted)]">—</span>
              <span className="text-2xl font-extrabold text-[var(--color-brand-700)]">
                {formatPrice(spec.price_range.fair_max, spec.price_range.currency)}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--color-line)] p-3">
                <p className="text-xs text-[var(--color-muted)]">
                  أقل من هذا السعر مريب (قد يكون قديماً أو غير أصلي)
                </p>
                <p className="mt-1 font-bold text-[var(--color-ink)]">
                  {formatPrice(spec.price_range.too_low, spec.price_range.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-line)] p-3">
                <p className="text-xs text-[var(--color-muted)]">
                  أعلى من هذا السعر مبالغ فيه لاحتياجك
                </p>
                <p className="mt-1 font-bold text-[var(--color-ink)]">
                  {formatPrice(spec.price_range.overpriced, spec.price_range.currency)}
                </p>
              </div>
            </div>
            <CardMuted>{spec.price_range.explanation}</CardMuted>
          </Card>

          {/* 4) Final recommendation — curated picks */}
          {(picks.length > 0 || report.avoid) && (
            <section className="space-y-4">
              <h2 className="text-xl font-extrabold text-[var(--color-ink)]">
                {UI.finalRecommendation}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {picks.map((p) => (
                  <LaptopCard
                    key={p.key}
                    scored={p.scored!}
                    highlight
                    badgeLabel={
                      RECOMMENDATION_TYPE_LABELS[
                        p.key as keyof typeof RECOMMENDATION_TYPE_LABELS
                      ]
                    }
                  />
                ))}
              </div>
              {report.avoid && (
                <div className="rounded-[var(--radius-card)] border border-[rgba(255,111,111,0.35)] bg-[rgba(255,111,111,0.08)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone="danger">{RECOMMENDATION_TYPE_LABELS.avoid}</Badge>
                  </div>
                  <LaptopCard scored={report.avoid} />
                </div>
              )}
            </section>
          )}

          {/* 5) All ranked options */}
          {scored.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-extrabold text-[var(--color-ink)]">
                {UI.options}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {scored.map((s) => (
                  <LaptopCard key={s.listing.id} scored={s} />
                ))}
              </div>
            </section>
          )}

          {/* 6) Closing narrative */}
          {report.narrative && (
            <Card className="space-y-2 bg-[var(--color-brand-50)]">
              <CardTitle>{UI.finalRecommendation}</CardTitle>
              <p className="text-sm leading-relaxed text-[var(--color-ink)] sm:text-base">
                {report.narrative}
              </p>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/sessions/${id}/compare`} className="btn btn-ghost">
              {UI.compare}
            </Link>
            <Link href="/sessions/new" className="btn btn-primary">
              {UI.newSession}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
