// Multi-agent MECE workers (Phase 2 step 3). Four cheap specialist agents run
// CONCURRENTLY (Promise.allSettled), each filling only its slice of the spec.
// A failed/slow/garbage worker is just a missing slice — never fatal. The
// synthesizer (in recommend.ts) reconciles them; if IT fails, runDeterministicMerge
// here is the floor. mergeTarget/num/sanitizePriceRange keep every tier NaN-proof.

import type {
  BasicNeeds,
  PriceRange,
  SpecRecommendation,
  SpecTarget,
  UserAnswer,
} from "@/lib/types";
import { chatJson } from "@/lib/ai/openrouter";
import {
  CONTRARIAN_SYSTEM,
  HARDWARE_SPECIALIST_SYSTEM,
  NEEDS_ANALYST_SYSTEM,
  ROI_EVALUATOR_SYSTEM,
  buildSpecUserPrompt,
} from "@/lib/ai/prompts";
import { mergeTarget, num, sanitizePriceRange } from "@/lib/ai/merge";

const WORKER_TIMEOUT_MS = 16_000;
const WORKER_MAX_TOKENS = 900;

type Confidence = "high" | "medium" | "low";

export interface NeedsAnalystOut {
  need_summary?: string;
  spec_range?: { minimum?: Partial<SpecTarget>; unnecessary?: string[] };
  confidence?: Confidence;
}
export interface HardwareOut {
  spec_range?: { ideal?: Partial<SpecTarget> };
  notes?: string;
  confidence?: Confidence;
}
export interface RoiOut {
  price_range?: Partial<PriceRange>;
  notes?: string;
  confidence?: Confidence;
}
export interface ContrarianOut {
  spec_range?: { unnecessary?: string[] };
  notes?: string;
  confidence_override?: Confidence | null;
}

export interface WorkerBundle {
  needs?: NeedsAnalystOut;
  hardware?: HardwareOut;
  roi?: RoiOut;
  contrarian?: ContrarianOut;
}

/** True when at least one worker returned usable data. */
export function hasWorkerData(b: WorkerBundle): boolean {
  return Boolean(b.needs || b.hardware || b.roi || b.contrarian);
}

/**
 * Run the four worker agents in one parallel batch. The shared user prompt is
 * buildSpecUserPrompt (baseline + answers + RAG grounding); each agent differs
 * only by system prompt. Rejections (timeout / non-200 / unparseable JSON) become
 * a missing slice. Wall-clock = the slowest worker, not the sum.
 */
export async function runWorkerAgents(
  basic: BasicNeeds,
  answers: UserAnswer[],
  grounding?: string,
): Promise<WorkerBundle> {
  const user = buildSpecUserPrompt(basic, answers, grounding);
  const call = <T>(system: string) =>
    chatJson<T>({ system, user, temperature: 0.3, maxTokens: WORKER_MAX_TOKENS, timeoutMs: WORKER_TIMEOUT_MS });

  const [needs, hardware, roi, contrarian] = await Promise.allSettled([
    call<NeedsAnalystOut>(NEEDS_ANALYST_SYSTEM),
    call<HardwareOut>(HARDWARE_SPECIALIST_SYSTEM),
    call<RoiOut>(ROI_EVALUATOR_SYSTEM),
    call<ContrarianOut>(CONTRARIAN_SYSTEM),
  ]);

  const val = <T>(r: PromiseSettledResult<T>): T | undefined =>
    r.status === "fulfilled" && r.value && typeof r.value === "object" ? r.value : undefined;

  return {
    needs: val(needs),
    hardware: val(hardware),
    roi: val(roi),
    contrarian: val(contrarian),
  };
}

function lowestConfidence(cs: Confidence[]): Confidence | undefined {
  if (!cs.length) return undefined;
  if (cs.includes("low")) return "low";
  if (cs.includes("medium")) return "medium";
  return "high";
}

/**
 * Deterministic field-by-field merge of the worker slices onto the baseline. This
 * is the floor used when the synthesizer is unavailable. Each spec field comes
 * from its MECE owner; everything missing falls back to the baseline.
 */
export function runDeterministicMerge(
  bundle: WorkerBundle,
  fallback: SpecRecommendation,
): SpecRecommendation {
  const { needs, hardware, roi, contrarian } = bundle;

  const minimum = mergeTarget(fallback.spec_range.minimum, needs?.spec_range?.minimum);
  const ideal = mergeTarget(fallback.spec_range.ideal, hardware?.spec_range?.ideal);

  const unnecessaryRaw = [
    ...(contrarian?.spec_range?.unnecessary ?? []),
    ...(needs?.spec_range?.unnecessary ?? []),
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);
  const unnecessary = unnecessaryRaw.length
    ? Array.from(new Set(unnecessaryRaw))
    : fallback.spec_range.unnecessary;

  const price_range: PriceRange = sanitizePriceRange(
    {
      currency: roi?.price_range?.currency || fallback.price_range.currency,
      too_low: num(roi?.price_range?.too_low, fallback.price_range.too_low),
      fair_min: num(roi?.price_range?.fair_min, fallback.price_range.fair_min),
      fair_max: num(roi?.price_range?.fair_max, fallback.price_range.fair_max),
      overpriced: num(roi?.price_range?.overpriced, fallback.price_range.overpriced),
      explanation: roi?.price_range?.explanation || fallback.price_range.explanation,
    },
    fallback.price_range,
  );

  const workerConfidences = [needs?.confidence, hardware?.confidence, roi?.confidence].filter(
    (c): c is Confidence => Boolean(c),
  );
  const confidence: Confidence =
    contrarian?.confidence_override ?? lowestConfidence(workerConfidences) ?? "medium";

  const notes =
    [hardware?.notes, roi?.notes, contrarian?.notes]
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter(Boolean)
      .join(" ") || fallback.notes;

  return {
    need_summary:
      typeof needs?.need_summary === "string" && needs.need_summary.trim()
        ? needs.need_summary.trim()
        : fallback.need_summary,
    spec_range: { minimum, ideal, unnecessary },
    price_range,
    confidence,
    notes,
    source: hasWorkerData(bundle) ? "ai" : "fallback",
  };
}
