import {
  BRAND_RELIABILITY,
  DEFAULT_BRAND_RELIABILITY,
  GPU_CLASS_MIN_TIER,
  RUBRIC_WEIGHTS,
  USE_CASE_BASELINES,
} from "@/lib/constants";
import type {
  BasicNeeds,
  Importance,
  LaptopListing,
  LaptopSpecs,
  PriceRange,
  ScoreBreakdown,
  ScoredLaptop,
  SpecRecommendation,
  SpecTarget,
} from "@/lib/types";
import { clamp, round } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Deterministic, inspectable scoring. The AI proposes spec TARGETS; this file
// turns targets + a catalog into transparent 0..100 scores per the rubric.
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Score a single value against a [min, ideal] band.
 *  - value >= ideal   -> 100
 *  - min <= value < ideal -> 70..100 (linear)
 *  - value < min      -> 0..70 (linear, harsh)
 */
function bandScore(value: number, min: number, ideal: number): number {
  // Defense-in-depth: never let a non-finite input produce NaN downstream.
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

function importanceWeight(imp: Importance): number {
  switch (imp) {
    case "very_important":
      return 1.0;
    case "somewhat":
      return 0.6;
    default:
      return 0.3;
  }
}

function resolutionWidth(res: string): number {
  const m = res.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (m) return parseInt(m[1], 10);
  if (/4k|uhd/i.test(res)) return 3840;
  if (/2k|qhd|1440/i.test(res)) return 2560;
  if (/fhd|1080/i.test(res)) return 1920;
  return 1366;
}

// ---------- Individual dimensions ----------

function scoreUseCaseFit(s: LaptopSpecs, spec: SpecRecommendation): number {
  const min = spec.spec_range.minimum;
  const ideal = spec.spec_range.ideal;

  const cpu = bandScore(s.cpu_tier, min.cpu_tier, ideal.cpu_tier);
  const ram = bandScore(s.ram_gb, min.ram_gb, ideal.ram_gb);
  const storage = bandScore(s.storage_gb, min.storage_gb, ideal.storage_gb);
  const gpu = bandScore(
    s.gpu_tier,
    GPU_CLASS_MIN_TIER[min.gpu] ?? 0,
    GPU_CLASS_MIN_TIER[ideal.gpu] ?? 0,
  );
  const width = resolutionWidth(s.display_resolution);
  const display = clamp(
    (width >= 1920 ? 100 : width >= 1600 ? 80 : 55) -
      (s.display_panel.toUpperCase() === "TN" ? 15 : 0),
    0,
    100,
  );

  return round(cpu * 0.3 + ram * 0.25 + gpu * 0.2 + storage * 0.15 + display * 0.1);
}

function performanceIndex(s: LaptopSpecs): number {
  // Everyday-performance proxy 0..100.
  return clamp(
    s.cpu_tier * 7 +
      s.gpu_tier * 3 +
      (Math.min(s.ram_gb, 32) / 32) * 18 +
      (s.storage_type === "SSD" ? 9 : 0),
    0,
    100,
  );
}

function scorePricePerformance(
  listing: LaptopListing,
  price_range: PriceRange,
  perf: number,
): number {
  const p = listing.price;
  let pos: number;
  if (p < price_range.too_low) pos = 55; // suspiciously cheap
  else if (p <= price_range.fair_min) pos = 95;
  else if (p <= price_range.fair_max) pos = 85;
  else if (p <= price_range.overpriced) pos = 60;
  else pos = 30;
  // A strong machine at a fair price earns extra ROI; a weak one loses some.
  return round(clamp(pos + (perf - 60) * 0.25, 0, 100));
}

function scoreBuildReliability(listing: LaptopListing): number {
  const s = listing.specs;
  const brand = listing.brand?.toLowerCase() ?? "";
  const base =
    (s.build_quality && s.build_quality > 0
      ? s.build_quality
      : BRAND_RELIABILITY[brand] ?? DEFAULT_BRAND_RELIABILITY) * 10;
  const ratingScore = listing.rating != null ? (listing.rating / 5) * 100 : base;
  const yearsOld = Math.max(0, CURRENT_YEAR - (s.release_year || CURRENT_YEAR));
  const agePenalty = Math.min(30, yearsOld * 6);
  return round(clamp(base * 0.55 + ratingScore * 0.45 - agePenalty, 0, 100));
}

function scoreBatteryPortability(s: LaptopSpecs, spec: SpecRecommendation, basic: BasicNeeds): number {
  const targetBattery = spec.spec_range.minimum.battery_hours_min || 6;
  const targetWeight = spec.spec_range.ideal.weight_kg_max || 1.8;
  const battery = bandScore(s.battery_hours, targetBattery, targetBattery + 4);
  const weight =
    s.weight_kg <= targetWeight
      ? 100
      : clamp(100 - (s.weight_kg - targetWeight) * 60, 0, 100);

  const bW = importanceWeight(basic.battery_importance);
  const pW = importanceWeight(basic.portability);
  const total = bW + pW || 1;
  return round((battery * bW + weight * pW) / total);
}

function scoreDisplayComfort(s: LaptopSpecs, basic: BasicNeeds): number {
  let size = 100;
  const inch = s.display_inch;
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
  const width = resolutionWidth(s.display_resolution);
  const resScore = width >= 1920 ? 100 : width >= 1600 ? 80 : 55;
  const panelScore =
    s.display_panel.toUpperCase() === "OLED"
      ? 100
      : s.display_panel.toUpperCase() === "IPS"
        ? 90
        : s.display_panel.toUpperCase() === "VA"
          ? 75
          : 60;
  return round(size * 0.4 + resScore * 0.3 + panelScore * 0.3);
}

function scoreUpgradeability(s: LaptopSpecs): number {
  // Unknown flags assume a mid value rather than penalizing.
  const ram = s.upgradeable_ram == null ? 60 : s.upgradeable_ram ? 100 : 30;
  const storage = s.upgradeable_storage == null ? 60 : s.upgradeable_storage ? 100 : 30;
  return round(ram * 0.5 + storage * 0.5);
}

function scoreLocalAvailability(listing: LaptopListing): number {
  const a = (listing.availability || "unknown").toLowerCase();
  let base: number;
  if (a.includes("in_stock") || a.includes("متوفر")) base = 100;
  else if (a.includes("preorder")) base = 70;
  else if (a.includes("out") || a.includes("نفد")) base = 20;
  else base = 60;
  if (listing.url) base = clamp(base + 0, 0, 100);
  return round(base);
}

// ---------- Reasons & warnings (Arabic) ----------

function buildReasons(listing: LaptopListing, spec: SpecRecommendation, b: ScoreBreakdown): string[] {
  const s = listing.specs;
  const reasons: string[] = [];
  const ideal = spec.spec_range.ideal;
  if (b.price_performance >= 80) reasons.push("سعر مناسب جداً مقابل الأداء الذي يقدّمه.");
  if (s.ram_gb >= ideal.ram_gb) reasons.push(`ذاكرة ${s.ram_gb}GB تكفي تعدّد المهام بأريحية.`);
  if (s.storage_type === "SSD") reasons.push(`تخزين SSD سريع بسعة ${s.storage_gb}GB.`);
  if (b.use_case_fit >= 80) reasons.push("مواصفاته تغطّي استخدامك المطلوب بشكل ممتاز.");
  if (b.battery_portability >= 80) reasons.push("بطارية وخفّة وزن مناسبة للتنقّل.");
  if (listing.rating != null && listing.rating >= 4.2)
    reasons.push(`تقييمات المستخدمين جيدة (${listing.rating}/5).`);
  if (s.arabic_keyboard) reasons.push("يدعم كيبورد عربي.");
  if (reasons.length === 0) reasons.push("خيار متوازن ضمن الفئة السعرية.");
  return reasons.slice(0, 4);
}

function buildWarnings(listing: LaptopListing, spec: SpecRecommendation, basic: BasicNeeds): string[] {
  const s = listing.specs;
  const min = spec.spec_range.minimum;
  const warnings: string[] = [];
  if (s.cpu_tier < min.cpu_tier) warnings.push("المعالج أضعف من الحد الأدنى المناسب لاستخدامك.");
  if (s.ram_gb < min.ram_gb) warnings.push(`الذاكرة (${s.ram_gb}GB) أقل من المطلوب (${min.ram_gb}GB).`);
  if (s.storage_type !== "SSD") warnings.push("القرص من نوع HDD وبطيء؛ يُفضّل SSD.");
  if (listing.price > spec.price_range.overpriced) warnings.push("السعر مبالغ فيه مقارنة بقيمته الفعلية.");
  if (listing.price < spec.price_range.too_low)
    warnings.push("السعر منخفض بشكل مريب؛ قد يكون الجهاز قديماً أو مستعملاً.");
  const yearsOld = CURRENT_YEAR - (s.release_year || CURRENT_YEAR);
  if (yearsOld >= 4) warnings.push(`الجهاز قديم نسبياً (موديل ${s.release_year}).`);
  if (listing.rating != null && listing.rating < 3.5) warnings.push("تقييمات المستخدمين ضعيفة.");
  if (basic.needs_arabic_keyboard && s.arabic_keyboard === false)
    warnings.push("لا يأتي بكيبورد عربي؛ قد تحتاج ملصقات أو نقش لاحقاً.");
  const a = (listing.availability || "").toLowerCase();
  if (a.includes("out") || a.includes("نفد")) warnings.push("غير متوفر حالياً في المتجر.");
  return warnings;
}

// ---------- Public API ----------

export function scoreLaptop(
  listing: LaptopListing,
  spec: SpecRecommendation,
  basic: BasicNeeds,
): ScoredLaptop {
  const s = listing.specs;
  const perf = performanceIndex(s);

  const breakdown: ScoreBreakdown = {
    use_case_fit: scoreUseCaseFit(s, spec),
    price_performance: scorePricePerformance(listing, spec.price_range, perf),
    build_reliability: scoreBuildReliability(listing),
    battery_portability: scoreBatteryPortability(s, spec, basic),
    display_comfort: scoreDisplayComfort(s, basic),
    upgradeability: scoreUpgradeability(s),
    local_availability: scoreLocalAvailability(listing),
  };

  const final_score = round(
    breakdown.use_case_fit * RUBRIC_WEIGHTS.use_case_fit +
      breakdown.price_performance * RUBRIC_WEIGHTS.price_performance +
      breakdown.build_reliability * RUBRIC_WEIGHTS.build_reliability +
      breakdown.battery_portability * RUBRIC_WEIGHTS.battery_portability +
      breakdown.display_comfort * RUBRIC_WEIGHTS.display_comfort +
      breakdown.upgradeability * RUBRIC_WEIGHTS.upgradeability +
      breakdown.local_availability * RUBRIC_WEIGHTS.local_availability,
  );

  const fit_score = breakdown.use_case_fit;
  const roi_score = round(
    breakdown.price_performance * 0.5 +
      breakdown.build_reliability * 0.3 +
      breakdown.use_case_fit * 0.2,
  );

  return {
    listing,
    breakdown,
    fit_score,
    roi_score,
    final_score,
    reasons: buildReasons(listing, spec, breakdown),
    warnings: buildWarnings(listing, spec, basic),
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

  const best_value = [...pool].sort((a, b) => b.roi_score - a.roi_score)[0];

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
    need_summary: `بناءً على إجاباتك، تحتاج جهازاً لـ"${basic.primary_use_case}" يوازن بين الأداء والسعر وخفة الحمل ضمن ميزانية ${basic.budget_min}–${basic.budget_max} ${basic.currency}.`,
    spec_range: { minimum, ideal, unnecessary: baseline.unnecessary },
    price_range,
    confidence: "medium",
    notes: "هذه توصية تقديرية مبنية على قواعد عامة (بدون نموذج ذكاء اصطناعي).",
    source: "fallback",
  };
}
