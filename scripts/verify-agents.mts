// Deterministic verification for the multi-agent MECE floor (no network/DB).
// Run from repo root:  npx tsx scripts/verify-agents.mts
// The live worker/synthesizer LLM calls need an API key and aren't exercised here;
// this verifies the deterministic merge + sanitizers + graceful fallback that run
// whenever the synthesizer (or any worker) is unavailable.

// Force AI off so buildRecommendation takes the deterministic floor deterministically.
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENROUTER_MULTI_AGENT;

import type { BasicNeeds, LaptopListing, LaptopSpecs, SpecRecommendation } from "@/lib/types";
import { fallbackSpecRecommendation } from "@/lib/scoring";
import { mergeSpec, sanitizePriceRange } from "@/lib/ai/merge";
import { runDeterministicMerge, type WorkerBundle } from "@/lib/ai/agents";
import { buildRecommendation } from "@/lib/ai/recommend";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`[${cond ? "PASS" : "FAIL"}] ${name}${detail ? `  — ${detail}` : ""}`);
}

const GPU_OK = new Set(["integrated", "entry_dedicated", "mid_dedicated", "high_dedicated"]);
function specIsSane(s: SpecRecommendation): { ok: boolean; why: string } {
  for (const t of [s.spec_range.minimum, s.spec_range.ideal]) {
    for (const k of ["cpu_tier", "ram_gb", "storage_gb", "display_inch_min", "display_inch_max", "battery_hours_min", "weight_kg_max"] as const) {
      if (!Number.isFinite(t[k])) return { ok: false, why: `${k}=${t[k]}` };
    }
    if (!GPU_OK.has(t.gpu)) return { ok: false, why: `gpu=${t.gpu}` };
  }
  const p = s.price_range;
  for (const k of ["too_low", "fair_min", "fair_max", "overpriced"] as const) {
    if (!Number.isFinite(p[k])) return { ok: false, why: `price.${k}=${p[k]}` };
  }
  if (!(p.too_low <= p.fair_min && p.fair_min <= p.fair_max && p.fair_max <= p.overpriced)) {
    return { ok: false, why: `price not monotonic ${p.too_low}/${p.fair_min}/${p.fair_max}/${p.overpriced}` };
  }
  return { ok: true, why: "" };
}

const basic: BasicNeeds = {
  budget_min: 150, budget_max: 250, currency: "KWD", country: "Kuwait", city_or_area: "الكويت",
  location_source: "manual_search", primary_use_case: "teaching", portability: "very_important",
  battery_importance: "very_important", screen_size_pref: "medium", needs_arabic_keyboard: true,
  condition_pref: "new", urgency: "soon",
};
const fallback = fallbackSpecRecommendation(basic);

// ---- empty bundle -> equals fallback, source "fallback" ----
const empty = runDeterministicMerge({}, fallback);
check("empty bundle -> source 'fallback'", empty.source === "fallback");
check("empty bundle -> sane spec", specIsSane(empty).ok, specIsSane(empty).why);

// ---- partial bundle (only ROI) -> price from ROI, rest from fallback, source ai ----
const roiOnly = runDeterministicMerge(
  { roi: { price_range: { currency: "KWD", too_low: 100, fair_min: 160, fair_max: 240, overpriced: 300, explanation: "x" }, confidence: "high" } },
  fallback,
);
check("ROI-only bundle -> source 'ai'", roiOnly.source === "ai");
check("ROI-only bundle -> price taken from ROI", roiOnly.price_range.fair_max === 240, `fair_max=${roiOnly.price_range.fair_max}`);
check("ROI-only bundle -> spec_range still from fallback", roiOnly.spec_range.minimum.cpu_tier === fallback.spec_range.minimum.cpu_tier);

// ---- garbage bundle -> NaN-proof, valid gpu, monotonic price, deduped unnecessary ----
const garbage: WorkerBundle = {
  needs: {
    need_summary: "  ",
    spec_range: { minimum: { cpu_tier: NaN as unknown as number, ram_gb: "16" as unknown as number, gpu: "super_gpu" as never, storage_type: "FLOPPY" as never }, unnecessary: ["a", "a"] },
    confidence: "low",
  },
  hardware: { spec_range: { ideal: { cpu_tier: undefined as unknown as number } } },
  roi: { price_range: { too_low: 500, fair_min: 100, fair_max: 50, overpriced: 10 } },
  contrarian: { spec_range: { unnecessary: ["b", "a"] }, confidence_override: "medium" },
};
const merged = runDeterministicMerge(garbage, fallback);
const sane = specIsSane(merged);
check("garbage bundle -> sane (no NaN, valid gpu, monotonic price)", sane.ok, sane.why);
check("garbage bundle -> empty need_summary falls back", merged.need_summary === fallback.need_summary);
check("garbage bundle -> unnecessary deduped", new Set(merged.spec_range.unnecessary).size === merged.spec_range.unnecessary.length, JSON.stringify(merged.spec_range.unnecessary));
check("garbage bundle -> contrarian confidence_override wins", merged.confidence === "medium", merged.confidence);
check("garbage bundle -> invalid storage_type falls back", ["SSD", "HDD", "either"].includes(merged.spec_range.minimum.storage_type), merged.spec_range.minimum.storage_type);

// ---- sanitizePriceRange ----
const fixed = sanitizePriceRange({ currency: "KWD", too_low: 300, fair_min: 100, fair_max: 200, overpriced: 50, explanation: "x" }, fallback.price_range);
check("sanitizePriceRange clamps to monotonic", fixed.too_low <= fixed.fair_min && fixed.fair_min <= fixed.fair_max && fixed.fair_max <= fixed.overpriced, JSON.stringify(fixed));
const nonpos = sanitizePriceRange({ currency: "KWD", too_low: 0, fair_min: -5, fair_max: 0, overpriced: 0, explanation: "x" }, fallback.price_range);
check("sanitizePriceRange falls back on non-positive", nonpos.fair_max === fallback.price_range.fair_max, JSON.stringify(nonpos));

// ---- mergeSpec: synth partial onto base ----
const base = roiOnly;
const refined = mergeSpec(base, { need_summary: "ملخص محسّن", spec_range: { ideal: { ram_gb: 16 } }, confidence: "high" });
check("mergeSpec keeps base where synth omits", refined.price_range.fair_max === base.price_range.fair_max);
check("mergeSpec applies synth overrides", refined.need_summary === "ملخص محسّن" && refined.spec_range.ideal.ram_gb === 16);
check("mergeSpec stays sane", specIsSane(refined).ok, specIsSane(refined).why);

// ---- end-to-end: buildRecommendation with AI off -> valid report, source fallback, no throw ----
function mk(id: string, price: number, specs: Partial<LaptopSpecs>): LaptopListing {
  const s: LaptopSpecs = {
    cpu: "x", cpu_tier: 6, ram_gb: 8, storage_gb: 256, storage_type: "SSD", gpu: "Intel", gpu_tier: 1,
    display_inch: 15.6, display_resolution: "1920x1080", display_panel: "IPS", battery_hours: 6,
    weight_kg: 1.7, os: "Windows 11", release_year: 2023,
  };
  return { id, store_name: "S", product_title: id, brand: "Lenovo", model: id, price, currency: "KWD",
    availability: "in_stock", url: null, country: "Kuwait", city_or_area: "الكويت", specs: { ...s, ...specs },
    rating: 4.3, review_count: 100, source_type: "seed", last_checked_at: "2026-06-28T00:00:00Z" };
}
const listings = [mk("a", 165, { ram_gb: 8 }), mk("b", 245, { ram_gb: 16, build_quality: 9 })];
const report = await buildRecommendation(basic, [], listings);
check("buildRecommendation (AI off) -> source 'fallback'", report.source === "fallback", report.source);
check("buildRecommendation (AI off) -> has narrative + picks", Boolean(report.narrative) && Boolean(report.best_overall), `best=${report.best_overall?.listing.id}`);
check("buildRecommendation (AI off) -> spec sane", specIsSane(report.spec).ok, specIsSane(report.spec).why);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
