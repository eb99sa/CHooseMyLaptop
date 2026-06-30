// Quality evaluation harness. Runs realistic personas (WITH follow-up answers) through
// the real pipeline — generates the follow-up questions AND the recommendation — and
// dumps a compact JSON for a strong-model judge to rate. This is the path simulate.mts
// did NOT exercise (it passed empty answers).
//
//   npx tsx scripts/evaluate.mts   # writes eval-results.json to the scratchpad + prints a summary

import { readFileSync, writeFileSync } from "node:fs";
function loadEnv(p: string) { try { for (const l of readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m || process.env[m[1]] != null) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } } catch {} }
loadEnv(".env.local");

import type { BasicNeeds, UserAnswer, ScoredLaptop } from "@/lib/types";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllListings } from "@/lib/data/listings";
import { generateFollowUpQuestions } from "@/lib/ai/questions";
import { buildRecommendation } from "@/lib/ai/recommend";
import { buildRetrievalQuery, retrieveKnowledge, formatGrounding } from "@/lib/ai/rag/retrieve";

const OUT = process.argv[2] || "eval-results.json";

function ans(question_text: string, answer_value: string): UserAnswer {
  return { question_key: question_text.slice(0, 12), question_text, answer_value, answer_type: "text" };
}
function base(b: Partial<BasicNeeds> & Pick<BasicNeeds, "budget_min" | "budget_max" | "primary_use_case">): BasicNeeds {
  return {
    currency: "KWD", country: "Kuwait", city_or_area: "الكويت", location_source: "manual_search",
    portability: "somewhat", battery_importance: "somewhat", screen_size_pref: "medium",
    needs_arabic_keyboard: true, condition_pref: "new", urgency: "soon", ...b,
  };
}

const PERSONAS: Array<{ label: string; expect: string; basic: BasicNeeds; answers: UserAnswer[] }> = [
  {
    label: "Final Cut Pro video editor, 500-700 KWD",
    expect: "MUST be Apple/MacBook (Final Cut is macOS-only); should use most of the budget.",
    basic: base({ budget_min: 500, budget_max: 700, primary_use_case: "video_editing", screen_size_pref: "large" }),
    answers: [ans("ما البرنامج الأساسي للمونتاج؟", "Final Cut Pro"), ans("دقة الفيديو؟", "4K"), ans("النظام المفضل؟", "ماك / macOS")],
  },
  {
    label: "Music producer, Logic Pro, 400-600 KWD",
    expect: "MUST be Apple (Logic Pro is macOS-only).",
    basic: base({ budget_min: 400, budget_max: 600, primary_use_case: "design" }),
    answers: [ans("ما البرامج؟", "Logic Pro, GarageBand لإنتاج الموسيقى"), ans("النظام؟", "ماك")],
  },
  {
    label: "Heavy programmer, Docker/VMs/Linux, 350-450 KWD",
    expect: "Windows/Linux ok; needs high RAM (32GB) + strong CPU; NOT a 150 KWD machine.",
    basic: base({ budget_min: 350, budget_max: 450, primary_use_case: "programming" }),
    answers: [ans("نوع البرمجة؟", "Docker, أجهزة افتراضية, تطوير backend, Linux"), ans("كم RAM تحتاج؟", "32GB على الأقل")],
  },
  {
    label: "AAA gamer, max settings, 550-650 KWD",
    expect: "High-end dedicated GPU (RTX 4070+); use the budget; NOT integrated graphics.",
    basic: base({ budget_min: 550, budget_max: 650, primary_use_case: "gaming", portability: "not_important", screen_size_pref: "large" }),
    answers: [ans("ما الألعاب؟", "Cyberpunk, Call of Duty على أعلى إعدادات"), ans("الأولوية؟", "أعلى أداء وإطارات")],
  },
  {
    label: "Office/email user, 130-180 KWD",
    expect: "CONTROL: a cheap, light laptop is correct here; should NOT over-spec.",
    basic: base({ budget_min: 130, budget_max: 180, primary_use_case: "office", portability: "very_important" }),
    answers: [ans("ما الاستخدام؟", "إيميل, إكسل, تصفّح"), ans("تنقّل؟", "نعم يومياً")],
  },
  {
    label: "University CS student, 300-400 KWD",
    expect: "Balanced: decent CPU + 16GB, portable; reasonable use of budget.",
    basic: base({ budget_min: 300, budget_max: 400, primary_use_case: "university", battery_importance: "very_important" }),
    answers: [ans("التخصص؟", "علوم حاسب"), ans("برامج ثقيلة؟", "برمجة وأجهزة افتراضية أحياناً")],
  },
];

const supabase = createServiceClient();
const listings = await fetchAllListings(supabase, { country: "Kuwait" });
console.error(`catalog: ${listings.length} listings\n`);

function pickInfo(s?: ScoredLaptop) {
  if (!s) return null;
  return { title: s.listing.product_title.slice(0, 70), brand: s.listing.brand, os: s.listing.specs.os, cpu: s.listing.specs.cpu, ram: s.listing.specs.ram_gb, gpu: s.listing.specs.gpu, price: s.listing.price, availability: s.listing.availability, score: s.final_score };
}

const results = [];
for (const p of PERSONAS) {
  console.error(`running: ${p.label}`);
  const { questions } = await generateFollowUpQuestions(p.basic);
  // Retrieve RAG grounding exactly like sessions.ts does, so the harness exercises the
  // real grounded pipeline (not the ungrounded shortcut it used before).
  const grounding = formatGrounding(await retrieveKnowledge(supabase, buildRetrievalQuery(p.basic, p.answers)));
  const r = await buildRecommendation(p.basic, p.answers, listings, grounding);
  results.push({
    persona: p.label,
    expectation: p.expect,
    budget: `${p.basic.budget_min}-${p.basic.budget_max} KWD`,
    use_case: p.basic.primary_use_case,
    rag_grounded: grounding.length > 0,
    rag_chars: grounding.length,
    answers: p.answers.map((a) => `${a.question_text} → ${a.answer_value}`),
    followup_questions: questions.map((q) => ({ q: q.question_text, opts: q.options?.map((o) => o.label) })),
    spec_os_min: r.spec.spec_range.minimum.os,
    spec_os_ideal: r.spec.spec_range.ideal.os,
    spec_cpu_tier_min: r.spec.spec_range.minimum.cpu_tier,
    spec_ram_min: r.spec.spec_range.minimum.ram_gb,
    price_range: `fair ${r.spec.price_range.fair_min}-${r.spec.price_range.fair_max}`,
    source: r.source,
    best_overall: pickInfo(r.best_overall),
    best_budget: pickInfo(r.best_budget),
    best_value: pickInfo(r.best_value),
    narrative: r.narrative.slice(0, 280),
  });
}

writeFileSync(OUT, JSON.stringify(results, null, 2));
console.error(`\nwrote ${results.length} persona results to ${OUT}`);
// Print a compact human summary to stdout.
for (const r of results) {
  console.log(`\n### ${r.persona}  [${r.budget}]`);
  console.log(`expect: ${r.expectation}`);
  console.log(`spec.os min/ideal: ${r.spec_os_min} / ${r.spec_os_ideal} | cpu_tier_min ${r.spec_cpu_tier_min} ram_min ${r.spec_ram_min} | ${r.price_range} | src=${r.source}`);
  console.log(`best_overall: ${r.best_overall ? `${r.best_overall.brand} | ${r.best_overall.os} | ${r.best_overall.title} | ${r.best_overall.price}KWD | ${r.best_overall.availability} | score ${r.best_overall.score}` : "—"}`);
  console.log(`best_budget : ${r.best_budget ? `${r.best_budget.brand} | ${r.best_budget.os} | ${r.best_budget.price}KWD` : "—"}`);
  console.log(`best_value  : ${r.best_value ? `${r.best_value.brand} | ${r.best_value.os} | ${r.best_value.price}KWD` : "—"}`);
}
