import type { ScoredLaptop } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FitScore } from "@/components/ui/FitScore";
import { PriceTag } from "@/components/ui/PriceTag";
import { Icon } from "@/components/ui/Icon";
import { SpecSignal } from "@/components/report/SpecSignal";
import { TrustBadge } from "@/components/report/TrustBadge";
import { UI } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LaptopCardProps {
  scored: ScoredLaptop;
  highlight?: boolean;
  badgeLabel?: string;
}

// A decision report, not a marketing card: rank, fit dial, KWD price, the
// signals that matter, and an honest why / where-it-may-not-fit.
export function LaptopCard({ scored, highlight = false, badgeLabel }: LaptopCardProps) {
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
          <h3 className="text-base font-bold leading-snug text-[var(--color-ink)]">
            {listing.product_title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-muted)]">
            {listing.brand && <span dir="auto">{listing.brand}</span>}
            {listing.store_name && (
              <>
                <span aria-hidden>•</span>
                <span dir="auto">{listing.store_name}</span>
              </>
            )}
          </div>
          <div className="pt-1">
            <PriceTag price={listing.price} currency={listing.currency} />
          </div>
        </div>
        <FitScore value={final_score} size={72} />
      </header>

      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <SpecSignal icon="cpu" code="CPU" value={s.cpu} />
        <SpecSignal icon="ram" code="RAM" value={`${s.ram_gb} GB`} />
        <SpecSignal icon="ssd" code={s.storage_type} value={`${s.storage_gb} GB`} />
        <SpecSignal icon="gpu" code="GPU" value={s.gpu} />
      </div>

      {highlight && (
        <div className="flex flex-wrap gap-2">
          {listing.store_name && <TrustBadge icon="store" label={listing.store_name} />}
          {roi_score >= 70 && <TrustBadge icon="value" label="قيمة عالية" verified />}
        </div>
      )}

      {reasons.length > 0 && (
        <ul className="flex flex-col gap-2">
          {reasons.slice(0, 3).map((r, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm leading-relaxed text-[var(--color-muted)]"
            >
              <span className="mt-0.5 shrink-0 text-[var(--color-success)]">
                <Icon name="check" size={16} />
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {warnings.slice(0, 3).map((w, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm leading-relaxed text-[var(--color-warning)]"
            >
              <span className="mt-0.5 shrink-0">
                <Icon name="alert" size={16} />
              </span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

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
