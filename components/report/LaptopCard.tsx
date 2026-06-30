import type { ListingReview, ScoredLaptop } from "@/lib/types";
import { USED_SOURCES } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { FitScore } from "@/components/ui/FitScore";
import { PriceTag } from "@/components/ui/PriceTag";
import { Icon } from "@/components/ui/Icon";
import { SpecBar } from "@/components/report/SpecBar";
import { Tip } from "@/components/ui/Tip";
import { UI } from "@/lib/i18n";
import { specMeters, shortLaptopName } from "@/lib/specView";
import { cn } from "@/lib/utils";

interface LaptopCardProps {
  scored: ScoredLaptop;
  highlight?: boolean;
  badgeLabel?: string;
  review?: ListingReview;
}

// A decision report, not a marketing card: rank, fit dial, KWD price, the
// signals that matter, and an honest why / where-it-may-not-fit.
export function LaptopCard({ scored, highlight = false, badgeLabel, review }: LaptopCardProps) {
  const { listing, final_score, roi_score, reasons, warnings } = scored;
  const s = listing.specs;

  return (
    <article
      className={cn(
        "card flex h-full flex-col gap-4 p-5",
        highlight && "shadow-[var(--shadow-lift)] ring-1 ring-[var(--color-line-strong)]",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          {badgeLabel && (
            <Badge tone={highlight ? "signal" : "neutral"} className="mb-1">
              {badgeLabel}
            </Badge>
          )}
          {listing.source_type === "seed" && (
            <Badge tone="warning" className="mb-1 ms-1">
              {UI.sampleBadge}
            </Badge>
          )}
          {USED_SOURCES.has(listing.source_type) && (
            <Badge tone="warning" className="mb-1 ms-1" title={UI.usedNote}>
              {UI.usedBadge}
            </Badge>
          )}
          <h3
            className="text-base font-bold leading-snug text-[var(--color-ink)]"
            title={listing.product_title}
            dir="auto"
          >
            {shortLaptopName(listing.product_title)}
          </h3>
          <div className="pt-1">
            <PriceTag price={listing.price} currency={listing.currency} />
          </div>
        </div>
        <FitScore value={final_score} size={72} />
      </header>

      {/* Each spec as what it MEANS + a strength bar (tech detail muted at the end). */}
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 min-[400px]:grid-cols-2">
        {specMeters(s).map((m) => (
          <SpecBar key={m.key} label={m.label} level={m.level} value={m.value} />
        ))}
      </div>

      {/* One short "why" line, then everything else folds into tap-chips (mobile-first). */}
      {reasons[0] && (
        <p className="flex gap-2 text-sm leading-relaxed text-[var(--color-muted)]">
          <span className="mt-0.5 shrink-0 text-[var(--color-success)]">
            <Icon name="check" size={16} />
          </span>
          <span>{reasons[0]}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {reasons.length > 1 && (
          <Tip
            tone="success"
            trigger={
              <>
                <Icon name="check" size={13} /> +{reasons.length - 1}
              </>
            }
          >
            <ul className="space-y-1.5">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="shrink-0 text-[var(--color-success)]">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Tip>
        )}
        {warnings.length > 0 && (
          <Tip
            tone="warning"
            trigger={
              <>
                <Icon name="alert" size={13} /> {warnings.length} {UI.warnings}
              </>
            }
          >
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="shrink-0">⚠</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Tip>
        )}
        {review && (review.summary || review.pros.length > 0 || review.cons.length > 0) && (
          <Tip trigger={<span dir="auto">حسب {review.source_name}</span>}>
            <div className="space-y-1.5">
              <p className="font-semibold text-[var(--color-muted)]" dir="auto">
                اختبارات {review.source_name}
              </p>
              {review.summary && <p>{review.summary}</p>}
              {review.pros.length > 0 && (
                <p className="text-[var(--color-success)]">+ {review.pros.join("، ")}</p>
              )}
              {review.cons.length > 0 && (
                <p className="text-[var(--color-warning)]">− {review.cons.join("، ")}</p>
              )}
              {review.source_url && (
                <a
                  href={review.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[var(--color-faint)] underline"
                >
                  {review.source_name}.com
                </a>
              )}
            </div>
          </Tip>
        )}
        {roi_score >= 70 && (
          <span className="text-xs font-semibold text-[var(--color-muted)]">قيمة عالية ✓</span>
        )}
      </div>

      {listing.url && (
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost mt-auto text-sm"
        >
          <Icon name="store" size={16} />
          الذهاب للمتجر
        </a>
      )}
    </article>
  );
}
