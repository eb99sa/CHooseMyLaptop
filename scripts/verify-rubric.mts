// Deterministic verification for the rubric v2 scoring engine (lib/rubric.ts).
// No test runner is wired into this project, so this is a standalone assertion
// script. Run from the repo root:
//
//   npx tsx scripts/verify-rubric.mts
//
// Exits non-zero if any check fails. Covers the missing-data / MECE / ROI /
// use-case-weighting guarantees.

import type { BasicNeeds, LaptopListing, LaptopSpecs } from "@/lib/types";
import {
  fallbackSpecRecommendation,
  rankLaptops,
  pickRecommendations,
  scoreLaptop,
} from "@/lib/scoring";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  const tag = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`[${tag}] ${name}${detail ? `  — ${detail}` : ""}`);
}

function mk(
  id: string,
  brand: string,
  price: number,
  availability: string,
  rating: number | null,
  specs: Partial<LaptopSpecs>,
): LaptopListing {
  const base: LaptopSpecs = {
    cpu: "x", cpu_tier: 6, ram_gb: 8, storage_gb: 256, storage_type: "SSD",
    gpu: "Intel", gpu_tier: 1, display_inch: 15.6, display_resolution: "1920x1080",
    display_panel: "IPS", battery_hours: 6, weight_kg: 1.7, os: "Windows 11",
    release_year: 2023,
  };
  return {
    id, store_name: "Store", product_title: id, brand, model: id, price,
    currency: "KWD", availability, url: "https://x", country: "Kuwait",
    city_or_area: "الكويت", specs: { ...base, ...specs }, rating, review_count: 100,
    source_type: "seed", last_checked_at: "2026-06-28T00:00:00Z",
  };
}

const teaching: BasicNeeds = {
  budget_min: 150, budget_max: 250, currency: "KWD", country: "Kuwait", city_or_area: "الكويت",
  location_source: "manual_search", primary_use_case: "teaching", portability: "very_important",
  battery_importance: "very_important", screen_size_pref: "medium", needs_arabic_keyboard: true,
  condition_pref: "new", urgency: "soon",
};
const gaming: BasicNeeds = {
  ...teaching, budget_min: 250, budget_max: 350, primary_use_case: "gaming",
  portability: "not_important", battery_importance: "not_important", screen_size_pref: "large",
};

// ---- 5) Rankings differ by use case ----------------------------------------
const fleet: LaptopListing[] = [
  mk("slim3", "Lenovo", 165, "in_stock", 4.3, { cpu_tier: 7, ram_gb: 8, storage_gb: 512, build_quality: 7, upgradeable_ram: true, upgradeable_storage: true }),
  mk("e14", "Lenovo", 245, "in_stock", 4.6, { cpu_tier: 7, ram_gb: 16, storage_gb: 512, gpu_tier: 2, display_inch: 14, display_resolution: "1920x1200", battery_hours: 9, weight_kg: 1.4, build_quality: 9, upgradeable_ram: true, upgradeable_storage: true }),
  mk("nitro", "Acer", 330, "preorder", 4.3, { cpu_tier: 7, ram_gb: 16, storage_gb: 512, gpu: "RTX 3050", gpu_tier: 5, battery_hours: 4, weight_kg: 2.5, build_quality: 6, upgradeable_ram: true, upgradeable_storage: true }),
  mk("zen", "ASUS", 320, "in_stock", 4.6, { cpu_tier: 7, ram_gb: 16, storage_gb: 512, display_inch: 14, display_resolution: "2880x1800", display_panel: "OLED", battery_hours: 12, weight_kg: 1.3, build_quality: 8, upgradeable_storage: true }),
];
const orderT = rankLaptops(fleet, fallbackSpecRecommendation(teaching), teaching).map((s) => s.listing.id);
const orderG = rankLaptops(fleet, fallbackSpecRecommendation(gaming), gaming).map((s) => s.listing.id);
check("use case changes ranking (teaching != gaming order)",
  JSON.stringify(orderT) !== JSON.stringify(orderG), `T=${orderT} G=${orderG}`);

// ---- 4) Junk-cheap laptop does not get high ROI ----------------------------
const specT = fallbackSpecRecommendation(teaching);
const junk = scoreLaptop(
  mk("junk", "NoName", 40, "in_stock", 2.5, { cpu_tier: 2, ram_gb: 4, storage_gb: 128, build_quality: 3, upgradeable_ram: false, upgradeable_storage: false }),
  specT, teaching,
);
check("junk-cheap roi stays modest (<= 60)", junk.roi_score <= 60,
  `roi=${junk.roi_score} (too_low=${specT.price_range.too_low})`);

// ---- 1) Missing weight is not perfect portability --------------------------
// Portability dominates (very_important) while battery does not (not_important),
// so a missing weight (0) must drag the score well below 100.
const weightProbe: BasicNeeds = { ...teaching, battery_importance: "not_important", portability: "very_important" };
const missingWeight = scoreLaptop(
  mk("nowt", "Lenovo", 200, "in_stock", 4.0, { battery_hours: 8, weight_kg: 0 }),
  fallbackSpecRecommendation(weightProbe), weightProbe,
);
check("weight_kg=0 is not perfect portability (<= 75)", missingWeight.breakdown.battery_portability <= 75,
  `battery_portability=${missingWeight.breakdown.battery_portability}`);
check("weight_kg=0 lowers battery confidence (< 0.8)",
  (missingWeight.breakdown.dim_confidence?.battery_portability ?? 1) < 0.8,
  `conf=${missingWeight.breakdown.dim_confidence?.battery_portability}`);

// ---- 2) Missing display size is not ideal ----------------------------------
const smallPref: BasicNeeds = { ...teaching, screen_size_pref: "small" };
const noInch = scoreLaptop(
  mk("noinch", "Lenovo", 200, "in_stock", 4.0, { display_inch: 0 }),
  fallbackSpecRecommendation(smallPref), smallPref,
);
check("display_inch=0 is not ideal display (<= 85)", noInch.breakdown.display_comfort <= 85,
  `display_comfort=${noInch.breakdown.display_comfort}`);
check("display_inch=0 lowers display confidence (< 1)",
  (noInch.breakdown.dim_confidence?.display_comfort ?? 1) < 1,
  `conf=${noInch.breakdown.dim_confidence?.display_comfort}`);

// ---- 3) Unknown panel / resolution lowers confidence (and never crashes) ----
const unknownDisplay = scoreLaptop(
  mk("nodisp", "Lenovo", 200, "in_stock", 4.0, { display_panel: "", display_resolution: "???" }),
  specT, teaching,
);
check("unknown panel/resolution lowers display confidence (<= 0.8)",
  (unknownDisplay.breakdown.dim_confidence?.display_comfort ?? 1) <= 0.8,
  `conf=${unknownDisplay.breakdown.dim_confidence?.display_comfort}`);

let crashed = false;
try {
  // display_panel null at runtime (despite the type) must not throw.
  scoreLaptop(
    mk("nullpanel", "Lenovo", 200, "in_stock", 4.0, { display_panel: null as unknown as string }),
    specT, teaching,
  );
} catch {
  crashed = true;
}
check("null display_panel does not crash", !crashed);

// ---- MECE spot-check: price_performance ignores compute strength ------------
// Two laptops at the same (fair) price but very different compute must get the
// SAME price_performance sub-score (compute is owned by use_case_fit only).
const ppWeak = scoreLaptop(mk("ppw", "Lenovo", 200, "in_stock", 4.0, { cpu_tier: 3, gpu_tier: 1, ram_gb: 8 }), specT, teaching);
const ppStrong = scoreLaptop(mk("pps", "Lenovo", 200, "in_stock", 4.0, { cpu_tier: 9, gpu_tier: 6, ram_gb: 32 }), specT, teaching);
check("price_performance is MECE (price-only, ignores compute)",
  ppWeak.breakdown.price_performance === ppStrong.breakdown.price_performance,
  `weak=${ppWeak.breakdown.price_performance} strong=${ppStrong.breakdown.price_performance}`);
check("...but compute still differentiates use_case_fit",
  ppStrong.breakdown.use_case_fit > ppWeak.breakdown.use_case_fit,
  `weak_fit=${ppWeak.breakdown.use_case_fit} strong_fit=${ppStrong.breakdown.use_case_fit}`);

// ---- best_value sanity: pickRecommendations doesn't crown junk --------------
const withJunk = pickRecommendations(
  rankLaptops([junk.listing, ...fleet], specT, teaching),
  teaching,
);
check("best_value is not the junk listing", withJunk.best_value?.listing.id !== "junk",
  `best_value=${withJunk.best_value?.listing.id}`);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
