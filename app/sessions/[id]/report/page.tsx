import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionForViewer } from "@/lib/services/sessions";
import { fetchReviewsForListings } from "@/lib/data/listings";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Card, CardTitle, CardMuted } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { PriceTag } from "@/components/ui/PriceTag";
import { StateView } from "@/components/ui/StateView";
import { LaptopCard } from "@/components/report/LaptopCard";
import { NeedsFlipCard } from "@/components/report/NeedsFlipCard";
import { RECOMMENDATION_TYPE_LABELS, UI } from "@/lib/i18n";
import { safeJsonParse } from "@/lib/utils";
import type { FinalReport, ListingReview } from "@/lib/types";

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
  // Seed rows are benchmark/test data; flag the whole report as estimated only when a
  // recommended PICK rests on seed (or the AI was unavailable). Individual seed cards
  // are labelled «بيانات تجريبية» regardless (see LaptopCard).
  const seedPick = [report.best_overall, report.best_budget, report.best_value, report.avoid].some(
    (p) => p?.listing.source_type === "seed",
  );
  const isEstimated = report.source === "fallback" || seedPick;
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

  // Third-party (rtings) reviews for every listing shown, attached by listing id.
  const listingIds = [
    ...scored.map((s) => s.listing.id),
    ...picks.map((p) => p.scored!.listing.id),
    report.avoid?.listing.id,
  ].filter((x): x is string => Boolean(x));
  const reviews: Map<string, ListingReview> = isDbConfigured()
    ? await fetchReviewsForListings(createServiceClient(), listingIds)
    : new Map();

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

          {/* 1) What you need — plain summary by default, flip to tech specs */}
          <NeedsFlipCard spec={spec} />

          {/* 3) Price range */}
          <Card className="space-y-4">
            <CardTitle>{UI.priceRange}</CardTitle>
            <PriceTag
              price={spec.price_range.fair_min}
              max={spec.price_range.fair_max}
              currency={spec.price_range.currency}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
                <p className="text-xs text-[var(--color-muted)]">
                  أقل من هذا السعر مريب (قد يكون قديماً أو غير أصلي)
                </p>
                <p className="mt-1.5">
                  <PriceTag
                    price={spec.price_range.too_low}
                    currency={spec.price_range.currency}
                    size="sm"
                  />
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
                <p className="text-xs text-[var(--color-muted)]">
                  أعلى من هذا السعر مبالغ فيه لاحتياجك
                </p>
                <p className="mt-1.5">
                  <PriceTag
                    price={spec.price_range.overpriced}
                    currency={spec.price_range.currency}
                    size="sm"
                  />
                </p>
              </div>
            </div>
            <CardMuted>{spec.price_range.explanation}</CardMuted>
          </Card>

          {/* No-match — honest empty state */}
          {scored.length === 0 && (
            <Card>
              <StateView
                icon="inbox"
                title="ما لقينا جهاز يطابق تمامًا"
                body="ما توفّر لنا جهاز يطابق مواصفاتك وميزانيتك في الكتالوج الحالي. جرّب ترفع الميزانية شوي أو تغيّر الأولوية وبنلقّى لك خيار أوضح."
              >
                <Link href="/sessions/new" className="btn btn-primary">
                  <Icon name="refresh" size={16} />
                  عدّل إجاباتك
                </Link>
              </StateView>
            </Card>
          )}

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
                    review={reviews.get(p.scored!.listing.id)}
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
                <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--tint-danger)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone="danger">{RECOMMENDATION_TYPE_LABELS.avoid}</Badge>
                  </div>
                  <LaptopCard scored={report.avoid} review={reviews.get(report.avoid.listing.id)} />
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
                  <LaptopCard key={s.listing.id} scored={s} review={reviews.get(s.listing.id)} />
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
