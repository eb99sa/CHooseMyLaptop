import type {
  BasicNeeds,
  FinalReport,
  LaptopListing,
  SpecRecommendation,
  UserAnswer,
} from "@/lib/types";
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
  pickRecommendations,
  rankLaptops,
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

function coreFrom(spec: SpecRecommendation, listings: LaptopListing[], basic: BasicNeeds): {
  core: ReportCore;
  picks: RecommendationPicks;
} {
  const scored = rankLaptops(listings, spec, basic);
  const picks = pickRecommendations(scored, basic);
  return {
    core: {
      spec,
      scored,
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
  const spec = await getSpecRecommendation(basic, answers, grounding);
  const { core } = coreFrom(spec, listings, basic);
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
  const fallback = fallbackSpecRecommendation(basic);

  const bundle = await runWorkerAgents(basic, answers, grounding);
  const provisionalSpec = runDeterministicMerge(bundle, fallback);

  // Provisional scoring so the synthesizer can reference the real picks while it
  // writes the narrative (the picks depend on the spec, the narrative on picks).
  const provisional = coreFrom(provisionalSpec, listings, basic);
  const synth = await runSynthesizer(basic, bundle, provisionalSpec, provisional.picks);

  // The synthesizer may refine the spec; re-score once for the authoritative picks.
  // source is honest about the SPEC's provenance: "ai" only when a worker actually
  // contributed — the synthesizer alone on an empty bundle just echoes the baseline.
  const aiShapedSpec = hasWorkerData(bundle);
  const spec: SpecRecommendation = {
    ...(synth?.spec ?? provisionalSpec),
    source: aiShapedSpec ? "ai" : "fallback",
  };
  const { core, picks } = coreFrom(spec, listings, basic);

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
