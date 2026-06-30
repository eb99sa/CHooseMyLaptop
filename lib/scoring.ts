import { SCORING_THRESHOLDS, USED_SOURCES, USE_CASE_BASELINES } from "@/lib/constants";
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

/** Mac-only software (the user literally can't run it on Windows) + an explicit Mac mention. */
const APPLE_ONLY = /final\s*cut|\bfcpx?\b|logic\s*pro|garage\s*band|\bxcode\b|\bimovie\b|apple\s*motion|فاينال\s*كت|لوجيك\s*برو|جراج\s*باند|آيموفي/i;
const APPLE_PREF = /\bmac\s*os\b|\bmacos\b|\bmacbook\b|ماكبوك|أبي\s*ماك|أفضّ?ل\s*ماك/i;

/**
 * Does this buyer REQUIRE an Apple machine? We never ask "Mac or Windows?" directly (the
 * audience doesn't know what's best for them — that's our job). So we infer a HARD Apple
 * requirement only from what the user actually ANSWERED: Mac-only software they named, or an
 * explicit "I want a MacBook". We scan answer VALUES, not the question text — otherwise a
 * needs-probing question like "do you use an iPhone?" would itself trip the keyword.
 * A soft "a Mac might suit you" isn't gated here; MacBooks already compete in the pool on fit.
 */
export function needsApplePlatform(basic: BasicNeeds, answers: { question_text: string; answer_value: string }[]): boolean {
  const hay = [basic.preferred_stores ?? "", ...answers.map((a) => a.answer_value)].join(" ");
  return APPLE_ONLY.test(hay) || APPLE_PREF.test(hay);
}

function isApple(l: LaptopListing): boolean {
  return l.brand.toLowerCase() === "apple" || l.specs.os === "macOS" || /\bmacbook\b/i.test(l.product_title);
}

/**
 * The set we actually RECOMMEND from — and the same set the report should display, so the
 * ranked list and the "best overall" pick never disagree (a higher-scored laptop the user
 * can't buy/use must not sit above the recommended one). Filters, in order:
 *   - drop seed (benchmark) rows,
 *   - drop no-OS (DOS/FreeDOS) machines a non-technical buyer can't use,
 *   - if Apple is required, keep only Apple/macOS,
 *   - keep within [budget_min*FRACTION, budget_max] (small undershoot allowed for value),
 *   - if anything is in stock, keep only in-stock (don't headline an unbuyable laptop).
 * Each filter falls back to the prior set if it would empty the pool. Returned score-sorted,
 * so element [0] is the headline pick.
 */
export function recommendablePool(
  scored: ScoredLaptop[],
  basic: BasicNeeds,
  opts: PickOptions = {},
): ScoredLaptop[] {
  if (scored.length === 0) return [];
  const real = scored.filter((s) => s.listing.source_type !== "seed");
  let base = real.length > 0 ? real : scored;

  const usable = base.filter((s) => s.listing.specs.os !== "DOS");
  if (usable.length > 0) base = usable;

  // Condition: a buyer who asked for NEW shouldn't be recommended used classifieds (4Sale/
  // OpenSooq). Buyers who chose «used» or «either» keep them (flagged «مستعمل» in the report).
  if (basic.condition_pref === "new") {
    const newOnly = base.filter((s) => !USED_SOURCES.has(s.listing.source_type));
    if (newOnly.length > 0) base = newOnly;
  }

  if (opts.requireApple) {
    const apple = base.filter((s) => isApple(s.listing));
    if (apple.length > 0) base = apple;
  }

  const floor = basic.budget_min > 0 ? basic.budget_min * SCORING_THRESHOLDS.BUDGET_MIN_FRACTION : 0;
  const inBand = base.filter((s) => s.listing.price >= floor && s.listing.price <= basic.budget_max);
  const underMax = base.filter((s) => s.listing.price <= basic.budget_max);
  let pool = inBand.length > 0 ? inBand : underMax.length > 0 ? underMax : base;

  const inStock = pool.filter((s) => s.listing.availability === "in_stock");
  if (inStock.length > 0) pool = inStock;

  return [...pool].sort((a, b) => b.final_score - a.final_score);
}

export function pickRecommendations(
  scored: ScoredLaptop[],
  basic: BasicNeeds,
  opts: PickOptions = {},
): RecommendationPicks {
  const pool = recommendablePool(scored, basic, opts);
  if (pool.length === 0) return {};

  // pool is score-sorted ⇒ best_overall is simply its highest-scored member, which is also
  // the top of the displayed list. No separate sort, so the two can never disagree.
  const best_overall = pool[0];

  // best_budget = the most AFFORDABLE machine that is still genuinely good (real fitness
  // floor — never a junk i3/4GB/HDD), distinct from best_overall.
  const goodEnough = pool.filter(
    (s) => s.final_score >= SCORING_THRESHOLDS.BEST_BUDGET_MIN_FINAL && s.warnings.length === 0,
  );
  const budgetPool = (goodEnough.length > 0 ? goodEnough : pool).filter(
    (s) => s.listing.id !== best_overall.listing.id,
  );
  const best_budget = [...budgetPool].sort(
    (a, b) => a.listing.price - b.listing.price || b.final_score - a.final_score,
  )[0];

  // best_value is roi-sorted among reasonably-fitting machines, distinct from the others.
  const chosen = new Set([best_overall.listing.id, best_budget?.listing.id].filter(Boolean));
  const valuePool = pool.filter(
    (s) => s.final_score >= SCORING_THRESHOLDS.BEST_VALUE_MIN_FINAL && !chosen.has(s.listing.id),
  );
  const valueFallback = pool.filter((s) => !chosen.has(s.listing.id));
  const best_value = [...(valuePool.length > 0 ? valuePool : valueFallback)].sort(
    (a, b) => b.roi_score - a.roi_score,
  )[0];

  // "avoid" is drawn from the broader REAL catalog (not the recommendable pool) so a
  // tempting-but-weak listing can still be flagged, as long as it isn't already a pick.
  const real = scored.filter((s) => s.listing.source_type !== "seed");
  const pickedIds = new Set(
    [best_overall, best_budget, best_value]
      .filter((p): p is ScoredLaptop => Boolean(p))
      .map((p) => p.listing.id),
  );
  const worst = [...(real.length > 0 ? real : scored)].sort((a, b) => a.final_score - b.final_score)[0];
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
