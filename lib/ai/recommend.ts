import type {
  BasicNeeds,
  FinalReport,
  GpuClass,
  LaptopListing,
  SpecRecommendation,
  SpecTarget,
  UserAnswer,
} from "@/lib/types";

// The AI is asked for one of these gpu classes; anything else is rejected so a
// stray string can never become an invalid scoring key (would yield NaN).
const GPU_CLASSES = new Set<string>([
  "integrated",
  "entry_dedicated",
  "mid_dedicated",
  "high_dedicated",
]);
import { chatJson, isAiConfigured } from "@/lib/ai/openrouter";
import {
  NARRATIVE_SYSTEM,
  SPEC_SYSTEM,
  buildNarrativeUserPrompt,
  buildSpecUserPrompt,
} from "@/lib/ai/prompts";
import {
  fallbackSpecRecommendation,
  pickRecommendations,
  rankLaptops,
} from "@/lib/scoring";

// Merge a (possibly partial) AI spec target onto a known-good baseline target,
// so a sparse model response can never produce NaN scores downstream.
function mergeTarget(base: SpecTarget, raw: Partial<SpecTarget> | undefined): SpecTarget {
  if (!raw) return base;
  const num = (v: unknown, d: number) => (typeof v === "number" && !Number.isNaN(v) ? v : d);
  return {
    cpu_class: typeof raw.cpu_class === "string" && raw.cpu_class ? raw.cpu_class : base.cpu_class,
    cpu_tier: num(raw.cpu_tier, base.cpu_tier),
    ram_gb: num(raw.ram_gb, base.ram_gb),
    storage_gb: num(raw.storage_gb, base.storage_gb),
    storage_type: raw.storage_type ?? base.storage_type,
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

async function getSpecRecommendation(
  basic: BasicNeeds,
  answers: UserAnswer[],
  grounding?: string,
): Promise<SpecRecommendation> {
  const fallback = fallbackSpecRecommendation(basic);
  if (!isAiConfigured()) return fallback;

  try {
    const raw = await chatJson<Partial<SpecRecommendation>>({
      system: SPEC_SYSTEM,
      user: buildSpecUserPrompt(basic, answers, grounding),
      temperature: 0.3,
      maxTokens: 1800,
    });

    const spec_range = raw.spec_range ?? fallback.spec_range;
    const merged: SpecRecommendation = {
      need_summary:
        typeof raw.need_summary === "string" && raw.need_summary
          ? raw.need_summary
          : fallback.need_summary,
      spec_range: {
        minimum: mergeTarget(fallback.spec_range.minimum, spec_range.minimum),
        ideal: mergeTarget(fallback.spec_range.ideal, spec_range.ideal),
        unnecessary:
          Array.isArray(spec_range.unnecessary) && spec_range.unnecessary.length
            ? spec_range.unnecessary
            : fallback.spec_range.unnecessary,
      },
      price_range: {
        currency: raw.price_range?.currency || fallback.price_range.currency,
        too_low: num(raw.price_range?.too_low, fallback.price_range.too_low),
        fair_min: num(raw.price_range?.fair_min, fallback.price_range.fair_min),
        fair_max: num(raw.price_range?.fair_max, fallback.price_range.fair_max),
        overpriced: num(raw.price_range?.overpriced, fallback.price_range.overpriced),
        explanation: raw.price_range?.explanation || fallback.price_range.explanation,
      },
      confidence: raw.confidence ?? "medium",
      notes: raw.notes,
      source: "ai",
    };
    return merged;
  } catch (err) {
    console.warn("[ai] spec recommendation fell back to deterministic:", (err as Error).message);
    return fallback;
  }
}

function num(v: unknown, d: number): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : d;
}

function fallbackNarrative(report: Omit<FinalReport, "narrative">): string {
  const parts: string[] = [];
  if (report.best_overall) {
    parts.push(
      `الخيار الأفضل عموماً هو "${report.best_overall.listing.product_title}" بسعر ${report.best_overall.listing.price} ${report.best_overall.listing.currency}، لأنه يوازن بين الأداء والسعر وجودة التصنيع (تقييم ${report.best_overall.final_score}/100).`,
    );
  }
  if (report.best_budget && report.best_budget.listing.id !== report.best_overall?.listing.id) {
    parts.push(
      `إذا أردت توفير المال فإن "${report.best_budget.listing.product_title}" يغطّي احتياجك الأساسي بسعر أقل.`,
    );
  }
  if (report.best_value && report.best_value.listing.id !== report.best_overall?.listing.id) {
    parts.push(
      `وللاستخدام طويل المدى، "${report.best_value.listing.product_title}" يقدّم أفضل قيمة مقابل سعره.`,
    );
  }
  if (report.avoid) {
    parts.push(
      `يُفضّل تجنّب "${report.avoid.listing.product_title}" لأنه ${report.avoid.warnings[0] ?? "أقل ملاءمة لاحتياجك"}.`,
    );
  }
  if (parts.length === 0) {
    parts.push("لم نجد أجهزة مطابقة كفاية في القائمة الحالية. جرّب توسيع الميزانية أو إضافة المزيد من الأجهزة.");
  }
  parts.push("ملاحظة: بعض البيانات تقديرية؛ تأكّد من السعر والتوفر في المتجر قبل الشراء.");
  return parts.join(" ");
}

async function getNarrative(
  basic: BasicNeeds,
  spec: SpecRecommendation,
  report: Omit<FinalReport, "narrative" | "source">,
): Promise<{ narrative: string; fromAi: boolean }> {
  if (isAiConfigured()) {
    try {
      const data = await chatJson<{ narrative?: string }>({
        system: NARRATIVE_SYSTEM,
        user: buildNarrativeUserPrompt(
          basic,
          { need_summary: spec.need_summary, spec_range: spec.spec_range },
          {
            best_overall: report.best_overall,
            best_budget: report.best_budget,
            best_value: report.best_value,
            avoid: report.avoid,
          },
        ),
        temperature: 0.5,
        maxTokens: 600,
      });
      if (data.narrative && data.narrative.trim()) {
        return { narrative: data.narrative.trim(), fromAi: true };
      }
    } catch (err) {
      console.warn("[ai] narrative fell back to template:", (err as Error).message);
    }
  }
  return { narrative: fallbackNarrative({ ...report, source: spec.source }), fromAi: false };
}

/**
 * Full pipeline: AI/fallback spec targets -> deterministic scoring ->
 * picks -> AI/fallback narrative. This is the function the API route calls.
 */
export async function buildRecommendation(
  basic: BasicNeeds,
  answers: UserAnswer[],
  listings: LaptopListing[],
  grounding?: string,
): Promise<FinalReport> {
  const spec = await getSpecRecommendation(basic, answers, grounding);
  const scored = rankLaptops(listings, spec, basic);
  const picks = pickRecommendations(scored, basic);

  const partial: Omit<FinalReport, "narrative" | "source"> = {
    spec,
    scored,
    best_overall: picks.best_overall,
    best_budget: picks.best_budget,
    best_value: picks.best_value,
    avoid: picks.avoid,
  };

  const { narrative, fromAi } = await getNarrative(basic, spec, partial);

  return {
    ...partial,
    narrative,
    source: spec.source === "ai" || fromAi ? "ai" : "fallback",
  };
}
