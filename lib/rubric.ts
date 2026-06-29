// ---------------------------------------------------------------------------
// Rubric v2 — the deterministic scoring engine (no AI, no network).
//
// The AI proposes spec TARGETS; this file turns targets + a catalog listing into
// transparent 0..100 sub-scores. Design goals over v1:
//   1. MECE dimensions — each spec field feeds exactly one weighted dimension:
//      compute (cpu/ram/gpu/storage) -> use_case_fit, display -> display_comfort,
//      price -> price_performance, battery/weight -> battery_portability,
//      build/rating/age -> build_reliability, upgrade flags -> upgradeability,
//      stock/url/freshness -> local_availability. No field is double-counted.
//   2. Per-use-case weights — final_score weighting is a function of UseCase.
//   3. Data honesty — every sub-engine returns a confidence; unknown/inferred
//      data lowers confidence (surfaced separately) and never inflates a score.
//   4. roi_score is a price-DOMINANT value signal, gated by adequacy
//      (use_case_fit), so it correlates with final_score but ranks differently —
//      best_value is not a clone of best_overall. (It is NOT independent of it.)
//
// scoring.ts orchestrates these into a ScoredLaptop. Keep this file framework-
// free and deterministic.
// ---------------------------------------------------------------------------

import {
  BRAND_RELIABILITY,
  COMPUTE_GPU_HEAVY,
  CONFIDENCE,
  DEFAULT_BRAND_RELIABILITY,
  GPU_CLASS_MIN_TIER,
  RUBRIC_WEIGHTS,
  SCORING_THRESHOLDS,
  USE_CASE_WEIGHTS,
} from "@/lib/constants";
import type {
  BasicNeeds,
  DimensionResult,
  Importance,
  LaptopListing,
  LaptopSpecs,
  PriceRange,
  RubricDimension,
  RubricWeights,
  ScoreBreakdown,
  SpecRecommendation,
  UseCase,
} from "@/lib/types";
import { clamp, round } from "@/lib/utils";
import { USE_CASE_LABELS } from "@/lib/i18n";

const CURRENT_YEAR = new Date().getFullYear();

// The seven weighted dimensions, in a stable order for dot products / iteration.
export const RUBRIC_DIMENSIONS: RubricDimension[] = [
  "use_case_fit",
  "price_performance",
  "build_reliability",
  "battery_portability",
  "display_comfort",
  "upgradeability",
  "local_availability",
];

// ---------------------------------------------------------------------------
// Shared helpers (moved here from scoring.ts so the engine is self-contained).
// ---------------------------------------------------------------------------

/**
 * Score a value against a [min, ideal] band.
 *  - value >= ideal       -> 100
 *  - min <= value < ideal -> 70..100 (linear)
 *  - value < min          -> 0..70  (linear, harsh)
 */
export function bandScore(value: number, min: number, ideal: number): number {
  if (!Number.isFinite(value)) value = 0;
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(ideal)) ideal = 0;
  if (min <= 0 && ideal <= 0) return 100; // nothing required
  const hi = Math.max(ideal, min);
  if (value >= hi) return 100;
  if (value >= min) {
    if (hi === min) return 100;
    return 70 + (30 * (value - min)) / (hi - min);
  }
  return clamp((70 * value) / Math.max(min, 1), 0, 70);
}

export function importanceWeight(imp: Importance): number {
  switch (imp) {
    case "very_important":
      return 1.0;
    case "somewhat":
      return 0.6;
    default:
      return 0.3;
  }
}

/** Best-effort horizontal pixel width from a resolution string. */
export function resolutionWidth(res: string): number {
  const m = res.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (m) return parseInt(m[1], 10);
  if (/4k|uhd/i.test(res)) return 3840;
  if (/2k|qhd|1440/i.test(res)) return 2560;
  if (/fhd|1080/i.test(res)) return 1920;
  return 1366;
}

/** True when a resolution string is explicitly parseable (not a 1366 fallback). */
function resolutionKnown(res: string): boolean {
  return /(\d{3,4})\s*[x×]\s*(\d{3,4})/i.test(res) || /4k|uhd|2k|qhd|1440|fhd|1080/i.test(res);
}

// ---------------------------------------------------------------------------
// Weight resolution + confidence aggregation.
// ---------------------------------------------------------------------------

/** The per-use-case weight profile, normalized to sum exactly 1.0. */
export function resolveWeights(useCase: UseCase | undefined): RubricWeights {
  const raw: RubricWeights =
    (useCase && USE_CASE_WEIGHTS[useCase]) || RUBRIC_WEIGHTS;
  const total = RUBRIC_DIMENSIONS.reduce((sum, k) => sum + (raw[k] || 0), 0) || 1;
  const out = {} as RubricWeights;
  for (const k of RUBRIC_DIMENSIONS) out[k] = (raw[k] || 0) / total;
  return out;
}

/** Use-case-weighted average of per-dimension confidence, as 0..100. */
export function computeDataConfidence(
  confByDim: Record<RubricDimension, number>,
  weights: RubricWeights,
): number {
  let acc = 0;
  let wsum = 0;
  for (const k of RUBRIC_DIMENSIONS) {
    acc += confByDim[k] * weights[k];
    wsum += weights[k];
  }
  return round((acc / (wsum || 1)) * 100);
}

/** Dimensions resting on uncertain data (confidence below the disclosure bar). */
export function lowConfidenceDims(
  confByDim: Record<RubricDimension, number>,
): RubricDimension[] {
  return RUBRIC_DIMENSIONS.filter((k) => confByDim[k] < CONFIDENCE.LOW_DIM);
}

// ---------------------------------------------------------------------------
// The seven sub-engines. Each returns { score (0..100), confidence (0.5..1.0) }.
// ---------------------------------------------------------------------------

/** Compute adequacy only: CPU/RAM/GPU/storage vs the target band. No display. */
export function scoreUseCaseFit(
  s: LaptopSpecs,
  spec: SpecRecommendation,
  useCase: UseCase,
): DimensionResult {
  const min = spec.spec_range.minimum;
  const ideal = spec.spec_range.ideal;

  const cpu = bandScore(s.cpu_tier, min.cpu_tier, ideal.cpu_tier);
  const ram = bandScore(s.ram_gb, min.ram_gb, ideal.ram_gb);
  const gpu = bandScore(
    s.gpu_tier,
    GPU_CLASS_MIN_TIER[min.gpu] ?? 0,
    GPU_CLASS_MIN_TIER[ideal.gpu] ?? 0,
  );
  const storage = bandScore(s.storage_gb, min.storage_gb, ideal.storage_gb);
  const storType = s.storage_type === "SSD" ? 100 : 35;

  const gpuHeavy = COMPUTE_GPU_HEAVY.has(useCase);
  const score = gpuHeavy
    ? round(cpu * 0.25 + ram * 0.22 + gpu * 0.33 + storage * 0.12 + storType * 0.08)
    : round(cpu * 0.38 + ram * 0.3 + gpu * 0.12 + storage * 0.12 + storType * 0.08);

  // Note: gpu_tier 0/1 is a valid *integrated* GPU, not missing data — so it is
  // never treated as low confidence. Only a zeroed cpu/ram signals missing data.
  const confidence =
    s.cpu_tier <= 0 || s.ram_gb <= 0 ? CONFIDENCE.COMPUTE_CORE_MISSING : CONFIDENCE.FULL;
  return { score, confidence };
}

/**
 * Value sanity: purely where the listing's price sits within the AI's fair band.
 * MECE — reads ONLY price. Compute strength is owned by use_case_fit and is
 * deliberately not re-read here, so final_score never double-counts raw power
 * (which would also reward overkill, against the "right specs, fair price, not
 * more" ethos). The price/value trade-off lives in roi_score instead.
 */
export function scorePricePerformance(
  listing: LaptopListing,
  priceRange: PriceRange,
): DimensionResult {
  const p = listing.price;
  const price_position =
    p < priceRange.too_low
      ? 40
      : p <= priceRange.fair_min
        ? 95
        : p <= priceRange.fair_max
          ? 85
          : p <= priceRange.overpriced
            ? 60
            : 25;
  // Price is always known, so this dimension is full confidence.
  return { score: round(price_position), confidence: CONFIDENCE.FULL };
}

/** Longevity/trust: explicit build_quality or brand prior, blended with rating, minus age. */
export function scoreBuildReliability(listing: LaptopListing): DimensionResult {
  const s = listing.specs;
  const brand = listing.brand?.toLowerCase() ?? "";
  const hasBuild = !!(s.build_quality && s.build_quality > 0);
  const bq = hasBuild
    ? (s.build_quality as number)
    : (BRAND_RELIABILITY[brand] ?? DEFAULT_BRAND_RELIABILITY);
  const base = bq * 10;
  const hasRating = listing.rating != null;
  const ratingScore = hasRating ? (listing.rating! / 5) * 100 : base;
  const yearsOld = Math.max(0, CURRENT_YEAR - (s.release_year || CURRENT_YEAR));
  const agePenalty = Math.min(
    SCORING_THRESHOLDS.MAX_AGE_PENALTY,
    yearsOld * SCORING_THRESHOLDS.AGE_PENALTY_PER_YEAR,
  );
  const score = round(clamp(base * 0.55 + ratingScore * 0.45 - agePenalty, 0, 100));
  const confidence =
    hasBuild && hasRating
      ? CONFIDENCE.FULL
      : hasBuild || hasRating
        ? CONFIDENCE.BUILD_ONE_MISSING
        : CONFIDENCE.BUILD_BRAND_PRIOR;
  return { score, confidence };
}

/** Mobility only: battery_hours vs target + weight vs target, by stated importance. */
export function scoreBatteryPortability(
  s: LaptopSpecs,
  spec: SpecRecommendation,
  basic: BasicNeeds,
): DimensionResult {
  const targetBattery =
    spec.spec_range.minimum.battery_hours_min || SCORING_THRESHOLDS.DEFAULT_BATTERY_TARGET;
  const targetWeight =
    spec.spec_range.ideal.weight_kg_max || SCORING_THRESHOLDS.DEFAULT_WEIGHT_TARGET;
  // Missing data (<= 0) must never score perfectly — use a neutral mid value and
  // let confidence (below) carry the uncertainty.
  const battery =
    s.battery_hours > 0 ? bandScore(s.battery_hours, targetBattery, targetBattery + 4) : 50;
  const weight =
    s.weight_kg <= 0
      ? 50
      : s.weight_kg <= targetWeight
        ? 100
        : clamp(100 - (s.weight_kg - targetWeight) * 60, 0, 100);

  const bW = importanceWeight(basic.battery_importance);
  const pW = importanceWeight(basic.portability);
  const score = round((battery * bW + weight * pW) / (bW + pW || 1));

  const hasB = s.battery_hours > 0;
  const hasW = s.weight_kg > 0;
  const confidence =
    hasB && hasW
      ? CONFIDENCE.FULL
      : hasB || hasW
        ? CONFIDENCE.BATTERY_ONE_MISSING
        : CONFIDENCE.BATTERY_BOTH_MISSING;
  return { score, confidence };
}

/** Screen experience only — the sole owner of every display field. */
export function scoreDisplayComfort(
  s: LaptopSpecs,
  basic: BasicNeeds,
  useCase: UseCase,
): DimensionResult {
  const inch = s.display_inch;
  let size: number;
  if (inch <= 0) {
    size = 60; // unknown screen size — neutral, never ideal
  } else {
    switch (basic.screen_size_pref) {
      case "small":
        size = inch <= 14 ? 100 : inch <= 15.6 ? 70 : 45;
        break;
      case "medium":
        size = inch >= 15 && inch <= 15.6 ? 100 : inch >= 14 && inch < 17 ? 80 : 55;
        break;
      case "large":
        size = inch >= 16 ? 100 : inch >= 15 ? 75 : 45;
        break;
      default:
        size = 90;
    }
  }

  const width = resolutionWidth(s.display_resolution);
  const resScore = width >= 2560 ? 100 : width >= 1920 ? 90 : width >= 1600 ? 72 : 48;
  const panel = (s.display_panel || "").toUpperCase();
  const panelScore =
    panel === "OLED" ? 100 : panel === "IPS" ? 90 : panel === "VA" ? 74 : panel === "TN" ? 50 : 65;

  const isGaming = useCase === "gaming";
  const refreshBonus =
    isGaming && s.display_refresh_hz != null && s.display_refresh_hz >= 120 ? 8 : 0;

  const score = round(clamp(size * 0.4 + resScore * 0.3 + panelScore * 0.3 + refreshBonus, 0, 100));

  const panelKnown = !!panel && panel !== "UNKNOWN";
  let confidence: number =
    panelKnown && resolutionKnown(s.display_resolution) && inch > 0
      ? CONFIDENCE.FULL
      : CONFIDENCE.DISPLAY_DEGRADED;
  if (isGaming && s.display_refresh_hz == null) {
    confidence = Math.min(confidence, CONFIDENCE.GAMING_REFRESH_UNKNOWN);
  }
  return { score, confidence };
}

/** Future-proofing: RAM/storage replaceability as a three-state signal. */
export function scoreUpgradeability(s: LaptopSpecs): DimensionResult {
  const U = SCORING_THRESHOLDS.UPGRADEABLE_UNKNOWN;
  const ram = s.upgradeable_ram === true ? 100 : s.upgradeable_ram === false ? 30 : U;
  const storage = s.upgradeable_storage === true ? 100 : s.upgradeable_storage === false ? 30 : U;
  const score = round(ram * 0.5 + storage * 0.5);

  const ramNull = s.upgradeable_ram == null;
  const stoNull = s.upgradeable_storage == null;
  const confidence =
    !ramNull && !stoNull
      ? CONFIDENCE.FULL
      : ramNull && stoNull
        ? CONFIDENCE.UPGRADE_BOTH_NULL
        : CONFIDENCE.UPGRADE_ONE_NULL;
  return { score, confidence };
}

/** Purchasability today: stock status + buy URL + listing freshness. */
export function scoreLocalAvailability(listing: LaptopListing): DimensionResult {
  const a = (listing.availability || "unknown").toLowerCase();
  const base =
    a.includes("in_stock") || a.includes("متوفر")
      ? 100
      : a.includes("preorder")
        ? 70
        : a.includes("out") || a.includes("نفد")
          ? 20
          : 45; // unknown — clearly below preorder/in_stock, above out_of_stock
  const urlBonus = listing.url ? 5 : 0;

  const checked = listing.last_checked_at ? Date.parse(listing.last_checked_at) : NaN;
  const daysOld = Number.isFinite(checked) ? (Date.now() - checked) / 86_400_000 : NaN;
  const stale = Number.isFinite(daysOld) && daysOld > SCORING_THRESHOLDS.FRESHNESS_GRACE_DAYS;
  const freshPenalty = stale
    ? Math.min(
        SCORING_THRESHOLDS.MAX_FRESHNESS_PENALTY,
        (daysOld - SCORING_THRESHOLDS.FRESHNESS_GRACE_DAYS) *
          SCORING_THRESHOLDS.FRESHNESS_PENALTY_PER_DAY,
      )
    : 0;

  const score = round(clamp(base + urlBonus - freshPenalty, 0, 100));
  const confidence =
    a === "unknown" || !listing.last_checked_at
      ? CONFIDENCE.AVAIL_UNKNOWN
      : stale
        ? CONFIDENCE.AVAIL_STALE
        : CONFIDENCE.FULL;
  return { score, confidence };
}

// ---------------------------------------------------------------------------
// roi_score — a price-DOMINANT value signal: how favorably the price sits vs the
// fair band, gated by adequacy (use_case_fit) so a junk-cheap machine can't read
// as "high value". It correlates with final_score but ranks differently, so
// best_value isn't a clone of best_overall (it is NOT independent of final_score).
// ---------------------------------------------------------------------------
export function priceAnchorRoi(
  listing: LaptopListing,
  priceRange: PriceRange,
  useCaseFitScore: number,
): number {
  const price = listing.price;
  if (!Number.isFinite(price) || price <= 0) return 50;
  const fairMid = (priceRange.fair_min + priceRange.fair_max) / 2;
  let priceFavor = clamp((fairMid / price) * 100, 0, 100);
  // A price below the "too low" floor is suspicious, not great value.
  if (price < priceRange.too_low) {
    priceFavor = Math.min(priceFavor, SCORING_THRESHOLDS.SUSPICIOUS_CHEAP_ROI_CAP);
  }
  const adequacy = clamp(useCaseFitScore, 0, 100) / 100;
  return round(clamp(priceFavor * (0.55 + 0.45 * adequacy), 0, 100));
}

// ---------------------------------------------------------------------------
// Explanations (Kuwaiti-colloquial Arabic), driven by the numbers + confidence.
// ---------------------------------------------------------------------------

export interface RubricContext {
  listing: LaptopListing;
  spec: SpecRecommendation;
  basic: BasicNeeds;
  breakdown: ScoreBreakdown;
  confByDim: Record<RubricDimension, number>;
  dataConfidence: number;
  useCase: UseCase;
}

export function buildReasons(ctx: RubricContext): string[] {
  const { listing, spec, breakdown: b, useCase, confByDim, dataConfidence } = ctx;
  const s = listing.specs;
  const ideal = spec.spec_range.ideal;
  const label = USE_CASE_LABELS[useCase] ?? useCase;
  const reasons: string[] = [];

  if (b.price_performance >= 82) reasons.push("سعره ممتاز مقابل اللي يقدّمه — قيمة حقيقية.");
  if (b.use_case_fit >= 80) reasons.push(`مواصفاته تغطّي استخدامك (${label}) بشكل ممتاز.`);
  if (s.ram_gb >= ideal.ram_gb) reasons.push(`ذاكرة ${s.ram_gb}GB مريحة لتعدّد المهام.`);
  if (s.storage_type === "SSD") reasons.push(`تخزين SSD سريع بسعة ${s.storage_gb}GB.`);
  if (b.battery_portability >= 80) reasons.push("بطاريته وخفّة وزنه مناسبة للتنقّل اليومي.");
  if (b.build_reliability >= 80 && confByDim.build_reliability >= 0.8)
    reasons.push("سمعة الماركة وتقييماته ممتازة.");
  if (b.display_comfort >= 85 && COMPUTE_GPU_HEAVY.has(useCase))
    reasons.push(`شاشته ممتازة لاستخدامك (${label}).`);
  if (listing.rating != null && listing.rating >= 4.2)
    reasons.push(`تقييمات المستخدمين زينة (${listing.rating}/5).`);
  if (s.arabic_keyboard) reasons.push("يجي بكيبورد عربي.");
  if (dataConfidence >= CONFIDENCE.REASON_HIGH) reasons.push("بيانات الجهاز مكتملة — النتيجة موثوقة.");

  if (reasons.length === 0) reasons.push("خيار متوازن ضمن فئته السعرية.");
  return reasons.slice(0, 4);
}

export function buildWarnings(ctx: RubricContext): string[] {
  const { listing, spec, basic, dataConfidence } = ctx;
  const s = listing.specs;
  const min = spec.spec_range.minimum;
  const warnings: string[] = [];

  if (s.cpu_tier < min.cpu_tier) warnings.push("المعالج أضعف من الحد الأدنى اللي يناسب استخدامك.");
  if (s.ram_gb < min.ram_gb) warnings.push(`الذاكرة (${s.ram_gb}GB) أقل من المطلوب (${min.ram_gb}GB).`);
  if (s.storage_type !== "SSD") warnings.push("القرص نوعه HDD وبطيء؛ الأفضل SSD.");
  if (listing.price > spec.price_range.overpriced) warnings.push("سعره مبالغ فيه مقارنة بقيمته.");
  if (listing.price < spec.price_range.too_low)
    warnings.push("سعره منخفض بشكل مريب؛ يمكن قديم أو مستعمل.");
  const yearsOld = CURRENT_YEAR - (s.release_year || CURRENT_YEAR);
  if (yearsOld >= 4) warnings.push(`الجهاز قديم نسبياً (موديل ${s.release_year}).`);
  if (listing.rating != null && listing.rating < 3.5) warnings.push("تقييمات المستخدمين ضعيفة.");
  if (basic.needs_arabic_keyboard && s.arabic_keyboard === false)
    warnings.push("ما يجي بكيبورد عربي؛ بتحتاج ملصقات لاحقاً.");
  const a = (listing.availability || "").toLowerCase();
  if (a.includes("out") || a.includes("نفد")) warnings.push("مو متوفر حالياً في المتجر.");
  if (s.upgradeable_ram == null && s.upgradeable_storage == null)
    warnings.push("معلومات ترقية الذاكرة/التخزين غير مؤكدة لهذا الجهاز.");

  // Honest aggregate disclosure when the listing's data is thin.
  if (dataConfidence < CONFIDENCE.WARN_VERYLOW)
    warnings.push("بيانات هذا الجهاز ناقصة بشكل كبير — لا تعتمد على درجته وحدها.");
  else if (dataConfidence < CONFIDENCE.WARN_LOW)
    warnings.push("بعض مواصفات هذا الجهاز غير مؤكدة — قد تختلف نتيجته الفعلية.");

  return warnings;
}

/** One canonical Arabic line per dimension (for a future ExplainPanel drill-down). */
export function buildDimensionReasons(
  b: ScoreBreakdown,
): Partial<Record<RubricDimension, string>> {
  const band = (n: number) =>
    n >= 80 ? "ممتاز" : n >= 60 ? "جيد" : n >= 40 ? "متوسط" : "ضعيف";
  return {
    use_case_fit: `ملاءمة المواصفات لاستخدامك: ${band(b.use_case_fit)} (${b.use_case_fit}/100).`,
    price_performance: `السعر مقابل الأداء: ${band(b.price_performance)} (${b.price_performance}/100).`,
    build_reliability: `جودة التصنيع والموثوقية: ${band(b.build_reliability)} (${b.build_reliability}/100).`,
    battery_portability: `البطارية وخفّة الوزن: ${band(b.battery_portability)} (${b.battery_portability}/100).`,
    display_comfort: `راحة الشاشة: ${band(b.display_comfort)} (${b.display_comfort}/100).`,
    upgradeability: `قابلية الترقية: ${band(b.upgradeability)} (${b.upgradeability}/100).`,
    local_availability: `التوفر محلياً: ${band(b.local_availability)} (${b.local_availability}/100).`,
  };
}
