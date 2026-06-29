// Recommendation simulation harness. Runs a MECE persona matrix (every use case ×
// budget tier) through the real recommender against the LIVE catalog, and flags
// quality issues (out-of-stock or seed "best overall", empty picks, price sanity).
//
//   npx tsx scripts/simulate.mts            # full 30-persona matrix, deterministic (no AI cost)
//   npx tsx scripts/simulate.mts --ai       # sample 6 personas through the FULL multi-agent + RAG pipeline
//
// Deterministic mode tests the rubric/scoring/picks over real data at scale; --ai mode
// spot-checks the actual AI output quality (costs a few OpenRouter/OpenAI calls per persona).

import { readFileSync } from "node:fs";
function loadEnv(p: string) { try { for (const l of readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m || process.env[m[1]] != null) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } } catch {} }
loadEnv(".env.local");

import type { BasicNeeds, Importance, ScreenSizePref, UseCase } from "@/lib/types";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllListings } from "@/lib/data/listings";
import { buildRecommendation } from "@/lib/ai/recommend";

const ai = process.argv.includes("--ai");
if (!ai) delete process.env.OPENROUTER_API_KEY; // deterministic full-matrix run, no AI cost

const USE_CASES: UseCase[] = ["teaching", "university", "office", "programming", "design", "engineering", "gaming", "video_editing", "business", "family"];
const BUDGETS = [
  { min: 120, max: 200 },
  { min: 220, max: 330 },
  { min: 380, max: 650 },
];

// Per-use-case preference shape (so personas are realistic, not uniform).
const PREFS: Partial<Record<UseCase, { port: Importance; batt: Importance; screen: ScreenSizePref }>> = {
  teaching: { port: "very_important", batt: "very_important", screen: "medium" },
  business: { port: "very_important", batt: "very_important", screen: "small" },
  gaming: { port: "not_important", batt: "not_important", screen: "large" },
  design: { port: "somewhat", batt: "somewhat", screen: "large" },
  video_editing: { port: "not_important", batt: "somewhat", screen: "large" },
  programming: { port: "somewhat", batt: "somewhat", screen: "medium" },
};

function persona(primary_use_case: UseCase, b: { min: number; max: number }): BasicNeeds {
  const p = PREFS[primary_use_case] ?? { port: "somewhat", batt: "somewhat", screen: "medium" };
  return {
    budget_min: b.min, budget_max: b.max, currency: "KWD", country: "Kuwait", city_or_area: "الكويت",
    location_source: "manual_search", primary_use_case, portability: p.port, battery_importance: p.batt,
    screen_size_pref: p.screen, needs_arabic_keyboard: true, condition_pref: "new", urgency: "soon",
  };
}

const supabase = createServiceClient();
const listings = await fetchAllListings(supabase, { country: "Kuwait" });
console.log(`catalog: ${listings.length} listings | mode: ${ai ? "AI (sample)" : "deterministic (full matrix)"}\n`);

const matrix = USE_CASES.flatMap((uc) => BUDGETS.map((b) => persona(uc, b)));
const run = ai ? matrix.filter((_, i) => i % 5 === 0).slice(0, 6) : matrix;

const flags = { total: 0, noPick: 0, oosBest: 0, seedBest: 0, overBudget: 0 };
for (const p of run) {
  const t0 = Date.now();
  const r = await buildRecommendation(p, [], listings);
  const bo = r.best_overall;
  flags.total++;
  if (!bo) { flags.noPick++; console.log(`${p.primary_use_case}/${p.budget_min}-${p.budget_max}: NO PICK`); continue; }
  const oos = bo.listing.availability !== "in_stock";
  const seed = bo.listing.source_type === "seed";
  const over = bo.listing.price > p.budget_max;
  if (oos) flags.oosBest++;
  if (seed) flags.seedBest++;
  if (over) flags.overBudget++;
  const tag = [oos ? "OOS" : "", seed ? "SEED" : "", over ? "OVER$" : ""].filter(Boolean).join(",");
  console.log(`${p.primary_use_case.padEnd(13)}/${p.budget_min}-${p.budget_max}: ${bo.listing.product_title.slice(0, 44).padEnd(44)} ${String(bo.listing.price).padStart(6)}KWD ${bo.listing.availability.padEnd(12)} ${bo.listing.source_type.padEnd(8)} score=${bo.final_score} ${tag}${ai ? ` (${Date.now() - t0}ms, ${r.source})` : ""}`);
  if (ai) {
    console.log(`   value=${r.best_value?.listing.product_title.slice(0, 36)} (${r.best_value?.listing.price}KWD) | budget=${r.best_budget?.listing.product_title.slice(0, 36)} (${r.best_budget?.listing.price}KWD)`);
    console.log(`   narrative: ${r.narrative.slice(0, 220)}…\n`);
  }
}

console.log(`\n=== flags over ${flags.total} personas ===`);
console.log(`no pick:               ${flags.noPick}`);
console.log(`best_overall OUT-OF-STOCK: ${flags.oosBest}`);
console.log(`best_overall is SEED:      ${flags.seedBest}`);
console.log(`best_overall OVER budget:  ${flags.overBudget}`);
