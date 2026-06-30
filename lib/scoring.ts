import { SCORING_THRESHOLDS, USE_CASE_BASELINES } from "@/lib/constants";
import type {
  BasicNeeds,
  LaptopListing,
  PriceRange,
  RubricDimension,
  ScoreBreakdown,
  ScoredLaptop,
  SpecRecommendation,
  SpecTarget,
} from "@/lib/types";
import { round } from "@/lib/utils";
import { USE_CASE_LABELS } from "@/lib/i18n";
import {
  RUBRIC_DIMENSIONS,
  buildDimensionReasons,
  buildReasons,
  buildWarnings,
  computeDataConfidence,
  lowConfidenceDims,
  priceAnchorRoi,
  resolveWeights,
  scoreBatteryPortability,
  scoreBuildReliability,
  scoreDisplayComfort,
  scoreLocalAvailability,
  scorePricePerformance,
  scoreUpgradeability,
  scoreUseCaseFit,
  type RubricContext,
} from "@/lib/rubric";

// ---------------------------------------------------------------------------
// Deterministic, inspectable scoring. The AI proposes spec TARGETS; lib/rubric.ts
// turns targets + a catalog into transparent 0..100 sub-scores. This file
// orchestrates the sub-engines, applies the per-use-case weight profile, and
// produces the picks. No AI here, so scores are reproducible and auditable.
// ---------------------------------------------------------------------------

/**
 * Score one laptop against the spec targets for this user's use case. The seven
 * UI-facing ScoreBreakdown dimensions are kept (with identical 0..100 ranges);
 * final_score is their dot product with the use-case weight profile.
 */
export function scoreLaptop(
  listing: LaptopListing,
  spec: SpecRecommendation,
  basic: BasicNeeds,
): ScoredLaptop {
  const s = listing.specs;
  const useCase = basic.primary_use_case;

  const ucf = scoreUseCaseFit(s, spec, useCase);
  const pp = scorePricePerformance(listing, spec.price_range);
  const build = scoreBuildReliability(listing);
  const batt = scoreBatteryPortability(s, spec, basic);
  const disp = scoreDisplayComfort(s, basic, useCase);
  const upg = scoreUpgradeability(s);
  const avail = scoreLocalAvailability(listing);

  const confByDim: Record<RubricDimension, number> = {
    use_case_fit: ucf.confidence,
    price_performance: pp.confidence,
    build_reliability: build.confidence,
    battery_portability: batt.confidence,
    display_comfort: disp.confidence,
    upgradeability: upg.confidence,
    local_availability: avail.confidence,
  };

  const breakdown: ScoreBreakdown = {
    use_case_fit: ucf.score,
    price_performance: pp.score,
    build_reliability: build.score,
    battery_portability: batt.score,
    display_comfort: disp.score,
    upgradeability: upg.score,
    local_availability: avail.score,
    dim_confidence: confByDim,
  };

  const weights = resolveWeights(useCase);
  const final_score = round(
    RUBRIC_DIMENSIONS.reduce((sum, k) => sum + breakdown[k] * weights[k], 0),
  );

  const fit_score = breakdown.use_case_fit;
  // roi_score: pure price-anchored value, shares no weighted input with final_score.
  const roi_score = priceAnchorRoi(listing, spec.price_range, fit_score);
  const data_confidence = computeDataConfidence(confByDim, weights);

  const ctx: RubricContext = {
    listing,
    spec,
    basic,
    breakdown,
    confByDim,
    dataConfidence: data_confidence,
    useCase,
  };

  return {
    listing,
    breakdown,
    fit_score,
    roi_score,
    final_score,
    reasons: buildReasons(ctx),
    warnings: buildWarnings(ctx),
    data_confidence,
    low_confidence_dims: lowConfidenceDims(confByDim),
    dimension_reasons: buildDimensionReasons(breakdown),
  };
}

export function rankLaptops(
  listings: LaptopListing[],
  spec: SpecRecommendation,
  basic: BasicNeeds,
): ScoredLaptop[] {
  return listings
    .map((l) => scoreLaptop(l, spec, basic))
    .sort((a, b) => b.final_score - a.final_score);
}

export interface RecommendationPicks {
  best_overall?: ScoredLaptop;
  best_budget?: ScoredLaptop;
  best_value?: ScoredLaptop;
  avoid?: ScoredLaptop;
}

export interface PickOptions {
  /** When true, only Apple/macOS machines are eligible for the positive picks. */
  requireApple?: boolean;
}

/** Mac-only software (the user literally can't run it on Windows) + explicit Mac choice. */
const APPLE_ONLY = /final\s*cut|\bfcpx?\b|logic\s*pro|garage\s*band|\bxcode\b|\bimovie\b|apple\s*motion|فاينال\s*كت|لوجيك|جراج\s*باند|آيموفي/i;
const APPLE_PREF = /\bmac\s*os\b|\bmacos\b|\bmacbook\b|\bmac\b|\bapple\b|ماك|ماكبوك|أبل|آبل/i;

/** Does this buyer require an Apple machine (Mac-only software or an explicit Mac choice)? */
export function needsApplePlatform(basic: BasicNeeds, answers: { question_text: string; answer_value: string }[]): boolean {
  const hay = [basic.preferred_stores ?? "", ...answers.map((a) => `${a.question_text} ${a.answer_value}`)].join(" ");
  return APPLE_ONLY.test(hay) || APPLE_PREF.test(hay);
}

function isApple(l: LaptopListing): boolean {
  return l.brand.toLowerCase() === "apple" || l.specs.os === "macOS" || /\bmacbook\b/i.test(l.product_title);
}

export function pickRecommendations(
  scored: ScoredLaptop[],
  basic: BasicNeeds,
  opts: PickOptions = {},
): RecommendationPicks {
  if (scored.length === 0) return {};
  // Seed rows are benchmark/test data — never RECOMMEND them as a pick (they still
  // appear, flagged, in the full ranked list). Fall back to them only if there is
  // nothing real to recommend at all.
  const real = scored.filter((s) => s.listing.source_type !== "seed");
  let base = real.length > 0 ? real : scored;

  // A machine with no usable OS (DOS/FreeDOS) is useless to a non-technical buyer — it
  // would need Windows bought + installed. Never headline one (it still shows in the list).
  const usable = base.filter((s) => s.listing.specs.os !== "DOS");
  if (usable.length > 0) base = usable;

  // Platform gate: a user who needs Apple (Mac-only software / Mac preference) must not
  // be handed a Windows machine they can't run their software on. If the catalog has no
  // Apple option in reach we leave base as-is — recommend.ts surfaces a warning rather
  // than silently violating the requirement.
  if (opts.requireApple) {
    const apple = base.filter((s) => isApple(s.listing));
    if (apple.length > 0) base = apple;
  }

  // Prefer a buyable (in-stock) machine for every headline pick.
  const stock = (s: ScoredLaptop) => (s.listing.availability === "in_stock" ? 0 : 1);

  // Respect BOTH ends of the stated budget. A 79 KWD pick for a 500-700 KWD buyer is
  // nonsense — keep picks within [budget_min*FRACTION, budget_max], allowing only a
  // small undershoot for genuine value.
  const floor = basic.budget_min > 0 ? basic.budget_min * SCORING_THRESHOLDS.BUDGET_MIN_FRACTION : 0;
  const inBand = base.filter((s) => s.listing.price >= floor && s.listing.price <= basic.budget_max);
  const underMax = base.filter((s) => s.listing.price <= basic.budget_max);
  const pool = inBand.length > 0 ? inBand : underMax.length > 0 ? underMax : base;

  const best_overall = [...pool].sort((a, b) => stock(a) - stock(b) || b.final_score - a.final_score)[0];

  // best_budget = the most AFFORDABLE machine that is still genuinely good (real fitness
  // floor — never a junk i3/4GB/HDD), distinct from best_overall.
  const goodEnough = pool.filter(
    (s) => s.final_score >= SCORING_THRESHOLDS.BEST_BUDGET_MIN_FINAL && s.warnings.length === 0,
  );
  const budgetPool = (goodEnough.length > 0 ? goodEnough : pool).filter(
    (s) => s.listing.id !== best_overall?.listing.id,
  );
  const best_budget = [...budgetPool].sort(
    (a, b) => stock(a) - stock(b) || a.listing.price - b.listing.price || b.final_score - a.final_score,
  )[0];

  // best_value is roi-sorted among reasonably-fitting machines, distinct from the others.
  const chosen = new Set([best_overall?.listing.id, best_budget?.listing.id].filter(Boolean));
  const valuePool = pool.filter(
    (s) => s.final_score >= SCORING_THRESHOLDS.BEST_VALUE_MIN_FINAL && !chosen.has(s.listing.id),
  );
  const valueFallback = pool.filter((s) => !chosen.has(s.listing.id));
  const best_value = [...(valuePool.length > 0 ? valuePool : valueFallback)].sort(
    (a, b) => stock(a) - stock(b) || b.roi_score - a.roi_score,
  )[0];

  // Worst candidate, surfaced only if it's genuinely weak AND it isn't already
  // recommended as one of the positive picks (avoid contradictory labeling). Drawn from
  // the FULL base (pre-band) so a junk floor machine can still be flagged.
  const pickedIds = new Set(
    [best_overall, best_budget, best_value]
      .filter((p): p is ScoredLaptop => Boolean(p))
      .map((p) => p.listing.id),
  );
  const worst = [...base].sort((a, b) => a.final_score - b.final_score)[0];
  const avoid =
    worst &&
    !pickedIds.has(worst.listing.id) &&
    (worst.final_score < 55 || worst.warnings.length >= 2)
      ? worst
      : undefined;

  return { best_overall, best_budget, best_value, avoid };
}

/**
 * Deterministic spec recommendation used when the AI is unavailable.
 * Derives targets from the use-case baseline, lightly adjusted by budget.
 */
export function fallbackSpecRecommendation(basic: BasicNeeds): SpecRecommendation {
  const baseline = USE_CASE_BASELINES[basic.primary_use_case];
  const minimum: SpecTarget = { ...baseline.minimum };
  const ideal: SpecTarget = { ...baseline.ideal };

  // Fair price band derived from the user's stated budget. Built monotonically
  // so too_low < fair_min <= fair_max < overpriced always holds (even for very
  // wide budget ranges or budget_min = 0).
  const mid = (basic.budget_min + basic.budget_max) / 2 || basic.budget_max || 250;
  const fair_min = round(basic.budget_min || mid * 0.7);
  const fair_max = round(basic.budget_max || mid * 1.05);
  const price_range: PriceRange = {
    currency: basic.currency || "KWD",
    too_low: round(fair_min * 0.6),
    fair_min,
    fair_max,
    overpriced: round(fair_max * 1.25),
    explanation:
      "النطاق العادل مبني على ميزانيتك واحتياجك. السعر الأقل بكثير قد يعني جهازاً قديماً، والأعلى بكثير مبالغة لا تحتاجها.",
  };

  return {
    need_summary: `بناءً على إجاباتك، تحتاج جهازاً لـ${USE_CASE_LABELS[basic.primary_use_case] ?? basic.primary_use_case} يوازن بين الأداء والسعر وخفة الحمل ضمن ميزانية ${basic.budget_min}–${basic.budget_max} ${basic.currency}.`,
    spec_range: { minimum, ideal, unnecessary: baseline.unnecessary },
    price_range,
    confidence: "medium",
    notes: "هذه توصية تقديرية مبنية على قواعد عامة (بدون نموذج ذكاء اصطناعي).",
    source: "fallback",
  };
}
