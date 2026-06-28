import type { GpuClass, RubricWeights, SpecTarget, UseCase } from "@/lib/types";

// ---------------------------------------------------------------------------
// Scoring rubric weights (must sum to 1.0). See README "Scoring" section.
// ---------------------------------------------------------------------------
export const RUBRIC_WEIGHTS = {
  use_case_fit: 0.3,
  price_performance: 0.25,
  build_reliability: 0.15,
  battery_portability: 0.1,
  display_comfort: 0.1,
  upgradeability: 0.05,
  local_availability: 0.05,
} as const;

// ---------------------------------------------------------------------------
// GPU class ordering, used to compare a laptop's gpu_tier to a target class.
// ---------------------------------------------------------------------------
export const GPU_CLASS_MIN_TIER: Record<GpuClass, number> = {
  integrated: 0,
  entry_dedicated: 3,
  mid_dedicated: 6,
  high_dedicated: 8,
};

// ---------------------------------------------------------------------------
// Rubric v2 — per-use-case weight profiles. The default RUBRIC_WEIGHTS above is
// the fallback; these tune the seven dimensions to what each buyer actually
// cares about (rows sum to 1.0; resolveWeights() re-normalizes to guard drift).
// ---------------------------------------------------------------------------
export const USE_CASE_WEIGHTS = {
  // Teachers move between classrooms: battery + portability matter, GPU doesn't.
  teaching: { use_case_fit: 0.26, price_performance: 0.22, build_reliability: 0.13, battery_portability: 0.19, display_comfort: 0.1, upgradeability: 0.05, local_availability: 0.05 },
  // Students want a balanced machine that lasts; value leads.
  university: { use_case_fit: 0.28, price_performance: 0.24, build_reliability: 0.13, battery_portability: 0.15, display_comfort: 0.1, upgradeability: 0.05, local_availability: 0.05 },
  // Office/browsing: battery + durability for long workdays; no dedicated GPU.
  office: { use_case_fit: 0.27, price_performance: 0.23, build_reliability: 0.14, battery_portability: 0.17, display_comfort: 0.09, upgradeability: 0.05, local_availability: 0.05 },
  // Coders need CPU/RAM above all, a little upgrade headroom, decent battery.
  programming: { use_case_fit: 0.33, price_performance: 0.22, build_reliability: 0.13, battery_portability: 0.13, display_comfort: 0.08, upgradeability: 0.06, local_availability: 0.05 },
  // Designers lean on color/display and a GPU; battery less so (near power).
  design: { use_case_fit: 0.29, price_performance: 0.2, build_reliability: 0.13, battery_portability: 0.08, display_comfort: 0.19, upgradeability: 0.06, local_availability: 0.05 },
  // CAD/simulation: strong compute + upgrade headroom for longevity.
  engineering: { use_case_fit: 0.31, price_performance: 0.21, build_reliability: 0.13, battery_portability: 0.08, display_comfort: 0.12, upgradeability: 0.1, local_availability: 0.05 },
  // Gaming = GPU + high-refresh display; battery nearly irrelevant (plugged in).
  gaming: { use_case_fit: 0.32, price_performance: 0.2, build_reliability: 0.12, battery_portability: 0.05, display_comfort: 0.2, upgradeability: 0.06, local_availability: 0.05 },
  // 4K editing: compute + color-accurate display + upgrade headroom.
  video_editing: { use_case_fit: 0.3, price_performance: 0.2, build_reliability: 0.12, battery_portability: 0.06, display_comfort: 0.19, upgradeability: 0.08, local_availability: 0.05 },
  // Business travellers: battery + weight + durability are paramount.
  business: { use_case_fit: 0.25, price_performance: 0.22, build_reliability: 0.16, battery_portability: 0.2, display_comfort: 0.07, upgradeability: 0.05, local_availability: 0.05 },
  // Family use = best value with durability; no pro specs needed.
  family: { use_case_fit: 0.25, price_performance: 0.27, build_reliability: 0.15, battery_portability: 0.13, display_comfort: 0.1, upgradeability: 0.05, local_availability: 0.05 },
} satisfies Record<UseCase, RubricWeights>;

// Use cases where raw GPU weighs more inside the compute (use_case_fit) score.
export const COMPUTE_GPU_HEAVY: Set<UseCase> = new Set([
  "gaming",
  "design",
  "engineering",
  "video_editing",
]);

// ---------------------------------------------------------------------------
// Centralized scoring thresholds (formerly scattered magic numbers).
// ---------------------------------------------------------------------------
export const SCORING_THRESHOLDS = {
  MAX_AGE_PENALTY: 30,
  AGE_PENALTY_PER_YEAR: 6,
  DEFAULT_BATTERY_TARGET: 6, // hours, when the spec target is unset
  DEFAULT_WEIGHT_TARGET: 1.8, // kg, when the spec target is unset
  UPGRADEABLE_UNKNOWN: 60, // neutral score for unknown upgradeability
  MAX_FRESHNESS_PENALTY: 15, // cap on the stale-listing availability penalty
  FRESHNESS_GRACE_DAYS: 7, // listings checked within N days aren't penalized
  FRESHNESS_PENALTY_PER_DAY: 1.5,
  SUSPICIOUS_CHEAP_ROI_CAP: 60, // a below-too_low price isn't "high value"
  BEST_VALUE_MIN_FINAL: 55, // best_value pick must clear this final_score
} as const;

// ---------------------------------------------------------------------------
// Per-dimension data-confidence levels (0.5..1.0). Confidence NEVER inflates a
// score — it only feeds the honest data_confidence signal and يحتاج تحقق notes.
// ---------------------------------------------------------------------------
export const CONFIDENCE = {
  FULL: 1.0,
  COMPUTE_CORE_MISSING: 0.6, // cpu_tier/ram zeroed out
  BUILD_ONE_MISSING: 0.8, // only build_quality OR rating present
  BUILD_BRAND_PRIOR: 0.6, // neither present — pure brand prior
  BATTERY_ONE_MISSING: 0.7,
  BATTERY_BOTH_MISSING: 0.5,
  DISPLAY_DEGRADED: 0.8, // panel unknown or resolution fell back
  GAMING_REFRESH_UNKNOWN: 0.85, // gaming + no display_refresh_hz
  UPGRADE_ONE_NULL: 0.75,
  UPGRADE_BOTH_NULL: 0.5,
  AVAIL_STALE: 0.8, // last_checked_at older than the grace window
  AVAIL_UNKNOWN: 0.6, // missing timestamp or 'unknown' availability
  // data_confidence (0..100) disclosure thresholds:
  REASON_HIGH: 90, // >= -> positive "data complete" reason
  WARN_LOW: 70, // < -> soft warning
  WARN_VERYLOW: 50, // < -> stronger warning
  LOW_DIM: 0.8, // a dim below this is listed in low_confidence_dims
} as const;

// Rough brand reliability proxy (1..10). Used only as a tie-breaker / prior
// when a listing has no explicit build_quality. Intentionally conservative.
export const BRAND_RELIABILITY: Record<string, number> = {
  apple: 9,
  lenovo: 8,
  dell: 8,
  hp: 7,
  asus: 7,
  acer: 6,
  msi: 6,
  microsoft: 8,
  samsung: 7,
  huawei: 7,
  lg: 7,
};

export const DEFAULT_BRAND_RELIABILITY = 6;

// ---------------------------------------------------------------------------
// Use-case baseline spec targets.
// These power the no-API fallback engine AND are passed to the AI as guidance
// so the model anchors on realistic, non-overpowered specs.
// cpu_tier / gpu use the same normalized scales as LaptopSpecs.
// ---------------------------------------------------------------------------
interface UseCaseBaseline {
  minimum: SpecTarget;
  ideal: SpecTarget;
  unnecessary: string[];
}

const WINDOWS = "Windows 11";

export const USE_CASE_BASELINES: Record<UseCase, UseCaseBaseline> = {
  teaching: {
    minimum: {
      cpu_class: "Intel Core i3 (12th gen+) / Ryzen 3 5000+",
      cpu_tier: 4,
      ram_gb: 8,
      storage_gb: 256,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 13,
      display_inch_max: 15.6,
      display_quality: "FHD IPS",
      battery_hours_min: 6,
      weight_kg_max: 1.8,
      os: WINDOWS,
      ports: ["HDMI", "USB-A", "USB-C"],
    },
    ideal: {
      cpu_class: "Intel Core i5 (12th gen+) / Ryzen 5 5000+",
      cpu_tier: 6,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 14,
      display_inch_max: 15.6,
      display_quality: "FHD IPS",
      battery_hours_min: 9,
      weight_kg_max: 1.5,
      os: WINDOWS,
      ports: ["HDMI", "USB-A", "USB-C"],
    },
    unnecessary: [
      "كرت شاشة منفصل (مخصص للألعاب) — لا يفيد التدريس ويزيد السعر والوزن",
      "معالج i7/i9 — أقوى من حاجتك ويستهلك بطارية أكثر",
      "شاشة 4K — تستنزف البطارية بدون فائدة حقيقية للعرض والتدريس",
    ],
  },
  university: {
    minimum: {
      cpu_class: "Intel Core i5 (12th gen+) / Ryzen 5 5000+",
      cpu_tier: 5,
      ram_gb: 8,
      storage_gb: 256,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 13,
      display_inch_max: 15.6,
      display_quality: "FHD IPS",
      battery_hours_min: 6,
      weight_kg_max: 1.8,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i5/i7 (12th gen+) / Ryzen 5/7 5000+",
      cpu_tier: 7,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "entry_dedicated",
      display_inch_min: 14,
      display_inch_max: 15.6,
      display_quality: "FHD IPS",
      battery_hours_min: 8,
      weight_kg_max: 1.6,
      os: WINDOWS,
    },
    unnecessary: [
      "كرت شاشة عالي للألعاب — إلا إذا كان تخصصك تصميم أو هندسة ثقيلة",
      "تخزين 2 تيرابايت — غالباً 512GB تكفي مع التخزين السحابي",
    ],
  },
  office: {
    minimum: {
      cpu_class: "Intel Core i3 (12th gen+) / Ryzen 3 5000+",
      cpu_tier: 4,
      ram_gb: 8,
      storage_gb: 256,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 13,
      display_inch_max: 15.6,
      display_quality: "FHD IPS",
      battery_hours_min: 6,
      weight_kg_max: 1.8,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i5 (12th gen+) / Ryzen 5 5000+",
      cpu_tier: 6,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 14,
      display_inch_max: 15.6,
      display_quality: "FHD IPS",
      battery_hours_min: 9,
      weight_kg_max: 1.5,
      os: WINDOWS,
    },
    unnecessary: [
      "كرت شاشة منفصل — لا يفيد أعمال المكتب",
      "معالج i9 وذاكرة 32GB — مبالغة لأعمال أوفيس وتصفح",
    ],
  },
  programming: {
    minimum: {
      cpu_class: "Intel Core i5 (12th gen+) / Ryzen 5 5000+",
      cpu_tier: 6,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 14,
      display_inch_max: 16,
      display_quality: "FHD IPS",
      battery_hours_min: 6,
      weight_kg_max: 1.9,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i7 (12th gen+) / Ryzen 7 5000+",
      cpu_tier: 8,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "entry_dedicated",
      display_inch_min: 14,
      display_inch_max: 16,
      display_quality: "FHD IPS / 2K",
      battery_hours_min: 8,
      weight_kg_max: 1.6,
      os: WINDOWS,
    },
    unnecessary: [
      "كرت شاشة عالي للألعاب — إلا إذا كنت تعمل على الذكاء الاصطناعي محلياً",
      "شاشة 4K لامعة — تقلل البطارية وتتعب العين في البرمجة الطويلة",
    ],
  },
  design: {
    minimum: {
      cpu_class: "Intel Core i5 (12th gen+) / Ryzen 5 5000+",
      cpu_tier: 6,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "entry_dedicated",
      display_inch_min: 14,
      display_inch_max: 16,
      display_quality: "FHD IPS بدقة ألوان جيدة (sRGB 100%)",
      battery_hours_min: 5,
      weight_kg_max: 2.0,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i7 (12th gen+) / Ryzen 7 5000+",
      cpu_tier: 8,
      ram_gb: 16,
      storage_gb: 1024,
      storage_type: "SSD",
      gpu: "mid_dedicated",
      display_inch_min: 15.6,
      display_inch_max: 16,
      display_quality: "2K/OLED بدقة ألوان عالية",
      battery_hours_min: 6,
      weight_kg_max: 1.8,
      os: WINDOWS,
    },
    unnecessary: [
      "أعلى كرت شاشة للألعاب — إلا للأعمال ثلاثية الأبعاد الثقيلة",
    ],
  },
  engineering: {
    minimum: {
      cpu_class: "Intel Core i5/i7 (12th gen+) / Ryzen 5/7 5000+",
      cpu_tier: 7,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "entry_dedicated",
      display_inch_min: 15.6,
      display_inch_max: 16,
      display_quality: "FHD IPS",
      battery_hours_min: 4,
      weight_kg_max: 2.2,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i7 (12th gen+) / Ryzen 7 5000+",
      cpu_tier: 8,
      ram_gb: 32,
      storage_gb: 1024,
      storage_type: "SSD",
      gpu: "mid_dedicated",
      display_inch_min: 15.6,
      display_inch_max: 16,
      display_quality: "FHD/2K IPS",
      battery_hours_min: 5,
      weight_kg_max: 2.0,
      os: WINDOWS,
    },
    unnecessary: [
      "شاشة OLED لامعة — تطبيقات الهندسة لا تحتاجها وقد تسبب وميضاً",
    ],
  },
  gaming: {
    minimum: {
      cpu_class: "Intel Core i5 (12th gen+) / Ryzen 5 6000+",
      cpu_tier: 7,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "mid_dedicated",
      display_inch_min: 15.6,
      display_inch_max: 16,
      display_quality: "FHD 144Hz",
      battery_hours_min: 3,
      weight_kg_max: 2.5,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i7 (13th gen+) / Ryzen 7 7000+",
      cpu_tier: 8,
      ram_gb: 16,
      storage_gb: 1024,
      storage_type: "SSD",
      gpu: "high_dedicated",
      display_inch_min: 15.6,
      display_inch_max: 16,
      display_quality: "FHD/2K 144Hz+",
      battery_hours_min: 4,
      weight_kg_max: 2.3,
      os: WINDOWS,
    },
    unnecessary: [
      "ذاكرة 64GB — نادراً ما تستفيد منها الألعاب",
      "شاشة 4K على جهاز محمول — تخفض الإطارات بشدة",
    ],
  },
  video_editing: {
    minimum: {
      cpu_class: "Intel Core i7 (12th gen+) / Ryzen 7 5000+",
      cpu_tier: 8,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "mid_dedicated",
      display_inch_min: 15.6,
      display_inch_max: 16,
      display_quality: "FHD IPS بدقة ألوان جيدة",
      battery_hours_min: 4,
      weight_kg_max: 2.2,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i7/i9 (13th gen+) / Ryzen 7/9 7000+",
      cpu_tier: 9,
      ram_gb: 32,
      storage_gb: 1024,
      storage_type: "SSD",
      gpu: "high_dedicated",
      display_inch_min: 15.6,
      display_inch_max: 16,
      display_quality: "2K/4K بدقة ألوان عالية",
      battery_hours_min: 5,
      weight_kg_max: 2.0,
      os: WINDOWS,
    },
    unnecessary: [],
  },
  business: {
    minimum: {
      cpu_class: "Intel Core i5 (12th gen+) / Ryzen 5 5000+",
      cpu_tier: 5,
      ram_gb: 8,
      storage_gb: 256,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 13,
      display_inch_max: 15.6,
      display_quality: "FHD IPS",
      battery_hours_min: 8,
      weight_kg_max: 1.5,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i7 (12th gen+) / Ryzen 7 5000+",
      cpu_tier: 7,
      ram_gb: 16,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 14,
      display_inch_max: 14,
      display_quality: "FHD IPS",
      battery_hours_min: 11,
      weight_kg_max: 1.3,
      os: WINDOWS,
    },
    unnecessary: [
      "كرت شاشة منفصل — يقلل البطارية ويزيد الوزن دون فائدة لأعمال الأعمال",
    ],
  },
  family: {
    minimum: {
      cpu_class: "Intel Core i3 (12th gen+) / Ryzen 3 5000+",
      cpu_tier: 3,
      ram_gb: 8,
      storage_gb: 256,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 14,
      display_inch_max: 15.6,
      display_quality: "FHD",
      battery_hours_min: 5,
      weight_kg_max: 2.0,
      os: WINDOWS,
    },
    ideal: {
      cpu_class: "Intel Core i5 (12th gen+) / Ryzen 5 5000+",
      cpu_tier: 5,
      ram_gb: 8,
      storage_gb: 512,
      storage_type: "SSD",
      gpu: "integrated",
      display_inch_min: 15.6,
      display_inch_max: 15.6,
      display_quality: "FHD IPS",
      battery_hours_min: 7,
      weight_kg_max: 1.8,
      os: WINDOWS,
    },
    unnecessary: [
      "مواصفات احترافية عالية — الاستخدام العائلي لا يحتاجها",
    ],
  },
};
