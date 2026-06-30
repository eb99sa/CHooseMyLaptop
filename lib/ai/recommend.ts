import type {
  BasicNeeds,
  FinalReport,
  GpuClass,
  LaptopListing,
  SpecRecommendation,
  UseCase,
  UserAnswer,
} from "@/lib/types";
import { COMPUTE_GPU_HEAVY, GPU_CLASS_MIN_TIER, USE_CASE_BASELINES } from "@/lib/constants";
import { chatJson, isAiConfigured } from "@/lib/ai/openrouter";
import {
  NARRATIVE_SYSTEM,
  SPEC_SYSTEM,
  SYNTH_SYSTEM,
  buildNarrativeUserPrompt,
  buildSpecUserPrompt,
  buildSynthUserPrompt,
} from "@/lib/ai/prompts";
import {
  fallbackSpecRecommendation,
  needsApplePlatform,
  pickRecommendations,
  rankLaptops,
  recommendablePool,
  type RecommendationPicks,
} from "@/lib/scoring";
import { mergeSpec } from "@/lib/ai/merge";
import {
  hasWorkerData,
  runDeterministicMerge,
  runWorkerAgents,
  type WorkerBundle,
} from "@/lib/ai/agents";

// Phase 2 step 3: the spec recommendation is produced by a real multi-agent MECE
// flow (4 parallel cheap workers -> 1 strong synthesizer that also writes the
// narrative). It degrades through deterministic tiers so any/all AI failure ends
// at fallbackSpecRecommendation — never a hard error. The legacy single-call path
// is preserved for the OPENROUTER_MULTI_AGENT=false kill-switch and the AI-off case.

function multiAgentEnabled(): boolean {
  return (process.env.OPENROUTER_MULTI_AGENT ?? "true").toLowerCase() !== "false";
}

type ReportCore = Omit<FinalReport, "narrative" | "source">;

// Picks are computed over the FULL ranked pool, but only the top N are stored /
// rendered as cards — the catalog can now hold hundreds of scraped listings and a
// report with hundreds of cards would be unusable.
const SCORED_LIMIT = 48;

// When the buyer needs Apple, make the spec honest about it so the displayed targets
// and the narrative agree with the (Apple-gated) picks.
function applyPlatform(spec: SpecRecommendation, requireApple: boolean): SpecRecommendation {
  if (!requireApple || spec.spec_range.minimum.os === "macOS") return spec;
  return {
    ...spec,
    spec_range: {
      ...spec.spec_range,
      minimum: { ...spec.spec_range.minimum, os: "macOS" },
      ideal: { ...spec.spec_range.ideal, os: "macOS" },
    },
  };
}

function higherGpu(a: GpuClass, b: GpuClass): GpuClass {
  return (GPU_CLASS_MIN_TIER[a] ?? 0) >= (GPU_CLASS_MIN_TIER[b] ?? 0) ? a : b;
}
// For GPU-heavy use cases (gaming / video editing) the calibrated use-case baseline owns the
// DECISIVE compute targets: the GPU is a floor the AI can't undercut, and RAM/CPU are anchored
// to the baseline so a model that over- or under-states them can't flip the ranking — e.g.
// inflating the gaming RAM target to 32GB and thereby penalising a 16GB gaming laptop that has
// a far stronger GPU. The AI still shapes price / display / narrative.
function clampComputeFloor(spec: SpecRecommendation, useCase: UseCase): SpecRecommendation {
  if (!COMPUTE_GPU_HEAVY.has(useCase)) return spec;
  const base = USE_CASE_BASELINES[useCase];
  const min = spec.spec_range.minimum;
  const ideal = spec.spec_range.ideal;
  return {
    ...spec,
    spec_range: {
      ...spec.spec_range,
      minimum: { ...min, gpu: higherGpu(min.gpu, base.minimum.gpu), ram_gb: base.minimum.ram_gb, cpu_tier: base.minimum.cpu_tier },
      ideal: { ...ideal, gpu: higherGpu(ideal.gpu, base.ideal.gpu), ram_gb: base.ideal.ram_gb, cpu_tier: base.ideal.cpu_tier },
    },
  };
}

// A laptop inside the user's stated budget must never be scored "overpriced" — that
// biases picks toward the cheapest machine and wastes budget the user is happy to spend.
// So the fair band's upper edge tracks budget_max regardless of what the AI returned.
function clampPriceToBudget(spec: SpecRecommendation, basic: BasicNeeds): SpecRecommendation {
  if (!(basic.budget_max > 0)) return spec;
  const pr = spec.price_range;
  const fair_max = Math.max(pr.fair_max, Math.round(basic.budget_max * 0.92));
  const overpriced = Math.max(pr.overpriced, Math.round(basic.budget_max * 1.1), Math.round(fair_max * 1.08));
  if (fair_max === pr.fair_max && overpriced === pr.overpriced) return spec;
  return { ...spec, price_range: { ...pr, fair_max, overpriced } };
}

// Apply every deterministic guard to a (possibly AI-shaped) spec: platform requirement,
// GPU floor for GPU-heavy use cases, and a budget-aligned price band.
function finalizeSpec(spec: SpecRecommendation, basic: BasicNeeds, requireApple: boolean): SpecRecommendation {
  return clampPriceToBudget(
    clampComputeFloor(applyPlatform(spec, requireApple), basic.primary_use_case),
    basic,
  );
}

function coreFrom(
  spec: SpecRecommendation,
  listings: LaptopListing[],
  basic: BasicNeeds,
  requireApple = false,
): {
  core: ReportCore;
  picks: RecommendationPicks;
} {
  const scored = rankLaptops(listings, spec, basic);
  const picks = pickRecommendations(scored, basic, { requireApple });
  // The report shows the RECOMMENDABLE set (not the raw catalog) so its top is best_overall
  // — a higher-scored laptop the user can't buy/use never sits above the recommended one.
  const display = recommendablePool(scored, basic, { requireApple });
  return {
    core: {
      spec,
      scored: display.slice(0, SCORED_LIMIT),
      best_overall: picks.best_overall,
      best_budget: picks.best_budget,
      best_value: picks.best_value,
      avoid: picks.avoid,
    },
    picks,
  };
}

// ---------------------------------------------------------------------------
// Narrative fallback (template) — used when the AI narrative is unavailable.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Legacy single-call path (kept for the kill-switch / AI-off case).
// ---------------------------------------------------------------------------
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
    return mergeSpec(fallback, raw);
  } catch (err) {
    console.warn("[ai] spec recommendation fell back to deterministic:", (err as Error).message);
    return fallback;
  }
}

async function getNarrative(
  basic: BasicNeeds,
  spec: SpecRecommendation,
  report: ReportCore,
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

async function legacyBuild(
  basic: BasicNeeds,
  answers: UserAnswer[],
  listings: LaptopListing[],
  grounding?: string,
): Promise<FinalReport> {
  const requireApple = needsApplePlatform(basic, answers);
  const spec = finalizeSpec(await getSpecRecommendation(basic, answers, grounding), basic, requireApple);
  const { core } = coreFrom(spec, listings, basic, requireApple);
  const { narrative, fromAi } = await getNarrative(basic, spec, core);
  return { ...core, narrative, source: spec.source === "ai" || fromAi ? "ai" : "fallback" };
}

// ---------------------------------------------------------------------------
// Multi-agent path. Workers (parallel) -> deterministic provisional spec ->
// provisional picks -> synthesizer (refines spec + writes narrative) -> re-score.
// ---------------------------------------------------------------------------
async function runSynthesizer(
  basic: BasicNeeds,
  bundle: WorkerBundle,
  baseSpec: SpecRecommendation,
  picks: RecommendationPicks,
): Promise<{ spec: SpecRecommendation; narrative: string } | null> {
  try {
    const raw = await chatJson<{ spec?: Partial<SpecRecommendation>; narrative?: string }>({
      system: SYNTH_SYSTEM,
      user: buildSynthUserPrompt(basic, baseSpec, bundle, picks),
      model: process.env.OPENROUTER_SYNTH_MODEL || process.env.OPENROUTER_MODEL,
      temperature: 0.3,
      maxTokens: 2400,
      timeoutMs: 22_000,
    });
    return {
      spec: mergeSpec(baseSpec, raw.spec ?? {}),
      narrative: typeof raw.narrative === "string" ? raw.narrative.trim() : "",
    };
  } catch (err) {
    console.warn("[ai] synthesizer fell back to deterministic merge:", (err as Error).message);
    return null;
  }
}

async function multiAgentBuild(
  basic: BasicNeeds,
  answers: UserAnswer[],
  listings: LaptopListing[],
  grounding?: string,
): Promise<FinalReport> {
  const requireApple = needsApplePlatform(basic, answers);
  const fallback = fallbackSpecRecommendation(basic);

  const bundle = await runWorkerAgents(basic, answers, grounding);
  const provisionalSpec = finalizeSpec(runDeterministicMerge(bundle, fallback), basic, requireApple);

  // Provisional scoring so the synthesizer can reference the real picks while it
  // writes the narrative (the picks depend on the spec, the narrative on picks).
  const provisional = coreFrom(provisionalSpec, listings, basic, requireApple);
  const synth = await runSynthesizer(basic, bundle, provisionalSpec, provisional.picks);

  // The synthesizer may refine the spec; re-score once for the authoritative picks.
  // source is honest about the SPEC's provenance: "ai" only when a worker actually
  // contributed — the synthesizer alone on an empty bundle just echoes the baseline.
  const aiShapedSpec = hasWorkerData(bundle);
  const spec: SpecRecommendation = finalizeSpec(
    { ...(synth?.spec ?? provisionalSpec), source: aiShapedSpec ? "ai" : "fallback" },
    basic,
    requireApple,
  );
  const { core, picks } = coreFrom(spec, listings, basic, requireApple);

  // The synth wrote its narrative against the provisional picks; only use it if the
  // re-score didn't move the headline pick, else fall back to the (always consistent)
  // template narrative.
  const synthNarrative = synth?.narrative?.trim();
  const picksStable =
    provisional.picks.best_overall?.listing.id === picks.best_overall?.listing.id;
  const narrativeFromAi = Boolean(synthNarrative && picksStable);
  const narrative = narrativeFromAi
    ? (synthNarrative as string)
    : fallbackNarrative({ ...core, source: spec.source });

  return {
    ...core,
    narrative,
    source: aiShapedSpec || narrativeFromAi ? "ai" : "fallback",
  };
}

/**
 * Full pipeline the API route calls. Multi-agent MECE when AI is configured and
 * not killed by OPENROUTER_MULTI_AGENT=false; otherwise the legacy single-call
 * path (which itself degrades to the deterministic fallback when AI is off).
 */
export async function buildRecommendation(
  basic: BasicNeeds,
  answers: UserAnswer[],
  listings: LaptopListing[],
  grounding?: string,
): Promise<FinalReport> {
  if (!isAiConfigured() || !multiAgentEnabled()) {
    return legacyBuild(basic, answers, listings, grounding);
  }
  return multiAgentBuild(basic, answers, listings, grounding);
}
