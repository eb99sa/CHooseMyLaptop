// Shared, NaN-proof merge helpers for AI-produced spec fragments.
//
// The AI (single-call, multi-agent workers, or the synthesizer) returns a
// possibly-sparse Partial<SpecRecommendation>. These helpers merge it onto a
// known-good base (the deterministic fallback or the worker-merged spec) so a
// missing/garbage field can never reach the scorer as NaN or an invalid enum.

import type { GpuClass, PriceRange, SpecRange, SpecRecommendation, SpecTarget } from "@/lib/types";

// The AI is asked for one of these gpu classes; anything else is rejected so a
// stray string can never become an invalid scoring key (would yield NaN).
export const GPU_CLASSES = new Set<string>([
  "integrated",
  "entry_dedicated",
  "mid_dedicated",
  "high_dedicated",
]);

/** Keep a finite number, else the default. */
export function num(v: unknown, d: number): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : d;
}

/** Merge a (possibly partial) spec target onto a known-good base target. */
export function mergeTarget(base: SpecTarget, raw: Partial<SpecTarget> | undefined): SpecTarget {
  if (!raw) return base;
  return {
    cpu_class: typeof raw.cpu_class === "string" && raw.cpu_class ? raw.cpu_class : base.cpu_class,
    cpu_tier: num(raw.cpu_tier, base.cpu_tier),
    ram_gb: num(raw.ram_gb, base.ram_gb),
    storage_gb: num(raw.storage_gb, base.storage_gb),
    storage_type:
      raw.storage_type === "SSD" || raw.storage_type === "HDD" || raw.storage_type === "either"
        ? raw.storage_type
        : base.storage_type,
    gpu:
      typeof raw.gpu === "string" && GPU_CLASSES.has(raw.gpu)
        ? (raw.gpu as GpuClass)
        : base.gpu,
    display_inch_min: num(raw.display_inch_min, base.display_inch_min),
    display_inch_max: num(raw.display_inch_max, base.display_inch_max),
    display_quality:
      typeof raw.display_quality === "string" && raw.display_quality
        ? raw.display_quality
        : base.display_quality,
    battery_hours_min: num(raw.battery_hours_min, base.battery_hours_min),
    weight_kg_max: num(raw.weight_kg_max, base.weight_kg_max),
    os: typeof raw.os === "string" && raw.os ? raw.os : base.os,
    ports: Array.isArray(raw.ports) ? raw.ports : base.ports,
  };
}

/**
 * Enforce too_low <= fair_min <= fair_max <= overpriced (the scorer assumes a
 * monotonic band). A single AI agent can produce price fields out of order; this
 * clamps them. Any non-positive field falls the whole band back to the baseline.
 */
export function sanitizePriceRange(p: PriceRange, fallback: PriceRange): PriceRange {
  const pos = (n: number) => Number.isFinite(n) && n > 0;
  if (!(pos(p.too_low) && pos(p.fair_min) && pos(p.fair_max) && pos(p.overpriced))) {
    return {
      currency: p.currency || fallback.currency,
      too_low: fallback.too_low,
      fair_min: fallback.fair_min,
      fair_max: fallback.fair_max,
      overpriced: fallback.overpriced,
      explanation: p.explanation || fallback.explanation,
    };
  }
  const too_low = p.too_low;
  const fair_min = Math.max(p.fair_min, too_low);
  const fair_max = Math.max(p.fair_max, fair_min);
  const overpriced = Math.max(p.overpriced, fair_max);
  return { currency: p.currency, too_low, fair_min, fair_max, overpriced, explanation: p.explanation };
}

/** Merge a partial SpecRecommendation onto a known-good base. source = "ai". */
export function mergeSpec(
  base: SpecRecommendation,
  raw: Partial<SpecRecommendation>,
): SpecRecommendation {
  const sr: Partial<SpecRange> = raw.spec_range ?? {};
  return {
    need_summary:
      typeof raw.need_summary === "string" && raw.need_summary.trim()
        ? raw.need_summary.trim()
        : base.need_summary,
    spec_range: {
      minimum: mergeTarget(base.spec_range.minimum, sr.minimum),
      ideal: mergeTarget(base.spec_range.ideal, sr.ideal),
      unnecessary:
        Array.isArray(sr.unnecessary) && sr.unnecessary.length
          ? sr.unnecessary.map((s) => String(s))
          : base.spec_range.unnecessary,
    },
    price_range: sanitizePriceRange(
      {
        currency: raw.price_range?.currency || base.price_range.currency,
        too_low: num(raw.price_range?.too_low, base.price_range.too_low),
        fair_min: num(raw.price_range?.fair_min, base.price_range.fair_min),
        fair_max: num(raw.price_range?.fair_max, base.price_range.fair_max),
        overpriced: num(raw.price_range?.overpriced, base.price_range.overpriced),
        explanation: raw.price_range?.explanation || base.price_range.explanation,
      },
      base.price_range,
    ),
    confidence: raw.confidence ?? base.confidence,
    notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : base.notes,
    source: "ai",
  };
}
