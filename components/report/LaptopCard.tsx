import type { ScoredLaptop } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { UI } from "@/lib/i18n";
import { cn, formatPrice } from "@/lib/utils";

interface LaptopCardProps {
  scored: ScoredLaptop;
  highlight?: boolean;
  badgeLabel?: string;
}

// Server, presentational. Renders one scored laptop with specs, scores, and notes.
export function LaptopCard({ scored, highlight = false, badgeLabel }: LaptopCardProps) {
  const { listing, fit_score, roi_score, final_score, reasons, warnings } = scored;
  const s = listing.specs;

  // Compact, Arabic-friendly key-specs line.
  const specBits = [
    s.cpu,
    `${s.ram_gb} GB رام`,
    `${s.storage_gb} GB ${s.storage_type}`,
    `شاشة ${s.display_inch} بوصة`,
    s.gpu,
    `${s.battery_hours} ساعات بطارية`,
    `${s.weight_kg} كجم`,
  ].filter(Boolean);

  return (
    <article
      className={cn(
        "card flex h-full flex-col gap-4 p-5",
        highlight && "border-[var(--color-brand-300)] shadow-[var(--shadow-lift)]",
      )}
    >
      <header className="space-y-2">
        {badgeLabel && (
          <Badge tone="brand" className="mb-1">
            {badgeLabel}
          </Badge>
        )}
        <h3 className="text-base font-bold leading-snug text-[var(--color-ink)]">
          {listing.product_title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-muted)]">
          {listing.brand && <span>{listing.brand}</span>}
          {listing.store_name && (
            <>
              <span aria-hidden>•</span>
              <span>{listing.store_name}</span>
            </>
          )}
        </div>
        <p className="text-lg font-extrabold text-[var(--color-brand-700)]">
          {formatPrice(listing.price, listing.currency)}
        </p>
      </header>

      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        {specBits.join(" · ")}
      </p>

      <div className="space-y-2">
        <ScoreBar label={UI.finalScore} value={final_score} />
        <div className="flex gap-2">
          <span className="chip bg-slate-100 text-slate-600">
            {UI.fitScore}: <b className="tabular-nums">{Math.round(fit_score)}</b>
          </span>
          <span className="chip bg-slate-100 text-slate-600">
            {UI.roiScore}: <b className="tabular-nums">{Math.round(roi_score)}</b>
          </span>
        </div>
      </div>

      {reasons.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-bold text-[var(--color-ink)]">{UI.pros}</p>
          <ul className="space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-[var(--color-muted)]">
                <span className="mt-0.5 shrink-0 text-[var(--color-success)]" aria-hidden>
                  ✓
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-bold text-[var(--color-ink)]">{UI.warnings}</p>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="flex gap-2 text-sm text-amber-700">
                <span className="mt-0.5 shrink-0" aria-hidden>
                  !
                </span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {listing.url && (
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost mt-auto text-sm"
        >
          الذهاب للمتجر
        </a>
      )}
    </article>
  );
}
