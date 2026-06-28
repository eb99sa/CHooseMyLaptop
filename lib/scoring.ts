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

export function pickRecommendations(
  scored: ScoredLaptop[],
  basic: BasicNeeds,
): RecommendationPicks {
  if (scored.length === 0) return {};
  const withinBudget = scored.filter((s) => s.listing.price <= basic.budget_max);
  const pool = withinBudget.length > 0 ? withinBudget : scored;

  const best_overall = [...pool].sort((a, b) => b.final_score - a.final_score)[0];

  const acceptable = pool.filter((s) => s.final_score >= 60 && s.warnings.length === 0);
  const budgetPool = acceptable.length > 0 ? acceptable : pool;
  const best_budget = [...budgetPool].sort(
    (a, b) => a.listing.price - b.listing.price || b.final_score - a.final_score,
  )[0];

  // best_value is roi-sorted, but only among reasonably-fitting machines so a
  // junk-cheap listing can't win purely on a favorable price ratio.
  const valuePool = pool.filter((s) => s.final_score >= SCORING_THRESHOLDS.BEST_VALUE_MIN_FINAL);
  const best_value = [...(valuePool.length > 0 ? valuePool : pool)].sort(
    (a, b) => b.roi_score - a.roi_score,
  )[0];

  // Worst candidate, surfaced only if it's genuinely weak AND it isn't already
  // recommended as one of the positive picks (avoid contradictory labeling).
  const pickedIds = new Set(
    [best_overall, best_budget, best_value]
      .filter((p): p is ScoredLaptop => Boolean(p))
      .map((p) => p.listing.id),
  );
  const worst = [...scored].sort((a, b) => a.final_score - b.final_score)[0];
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
