// Shared domain types for CHooseMyLaptop.
// These are the contracts the whole app is built around: the questionnaire,
// the AI spec recommendation, the laptop catalog, and the scored report.

export type UseCase =
  | "teaching"
  | "university"
  | "office"
  | "programming"
  | "design"
  | "engineering"
  | "gaming"
  | "video_editing"
  | "business"
  | "family";

export type AnswerType =
  | "text"
  | "number"
  | "boolean"
  | "single_select"
  | "multi_select";

export type Importance = "very_important" | "somewhat" | "not_important";
export type ScreenSizePref = "small" | "medium" | "large" | "no_pref";
export type ConditionPref = "new" | "used" | "either";
export type Urgency = "now" | "soon" | "can_wait";

// ---------------------------------------------------------------------------
// Page 1 — Basic structured needs
// ---------------------------------------------------------------------------
export interface BasicNeeds {
  budget_min: number;
  budget_max: number;
  currency: string; // e.g. "KWD"
  country: string;
  city: string;
  preferred_language: string; // e.g. "ar"
  primary_use_case: UseCase;
  portability: Importance;
  battery_importance: Importance;
  screen_size_pref: ScreenSizePref;
  needs_arabic_keyboard: boolean;
  condition_pref: ConditionPref;
  preferred_stores?: string;
  urgency: Urgency;
}

// ---------------------------------------------------------------------------
// Page 2 — AI-generated follow-up questions + their answers
// ---------------------------------------------------------------------------
export interface AIQuestionOption {
  value: string;
  label: string; // Arabic
}

export interface AIQuestion {
  question_key: string;
  question_text: string; // Arabic, simple language
  question_type: AnswerType;
  options?: AIQuestionOption[];
  reason?: string; // why we ask (Arabic), used for inspectability
  sort_order: number;
}

export interface UserAnswer {
  question_key: string;
  question_text: string;
  answer_value: string; // stored as string (JSON-encoded for multi_select)
  answer_type: AnswerType;
}

// ---------------------------------------------------------------------------
// AI spec recommendation
// ---------------------------------------------------------------------------
export type GpuClass =
  | "integrated"
  | "entry_dedicated"
  | "mid_dedicated"
  | "high_dedicated";

export interface SpecTarget {
  cpu_class: string; // human label, e.g. "Intel Core i5 (12th gen+) / Ryzen 5 5000+"
  cpu_tier: number; // 1..10 normalized minimum tier
  ram_gb: number;
  storage_gb: number;
  storage_type: "SSD" | "HDD" | "either";
  gpu: GpuClass;
  display_inch_min: number;
  display_inch_max: number;
  display_quality: string; // e.g. "FHD IPS"
  battery_hours_min: number;
  weight_kg_max: number;
  os: string; // e.g. "Windows 11"
  ports?: string[];
}

export interface SpecRange {
  minimum: SpecTarget;
  ideal: SpecTarget;
  unnecessary: string[]; // Arabic: specs that would be overkill / wasted money
}

export interface PriceRange {
  currency: string;
  too_low: number; // below this = suspiciously cheap / likely old or fake
  fair_min: number;
  fair_max: number;
  overpriced: number; // above this = overpriced for this user
  explanation: string; // Arabic
}

export interface SpecRecommendation {
  need_summary: string; // Arabic, plain language
  spec_range: SpecRange;
  price_range: PriceRange;
  confidence: "high" | "medium" | "low";
  notes?: string; // Arabic
  source: "ai" | "fallback";
}

// ---------------------------------------------------------------------------
// Laptop catalog
// ---------------------------------------------------------------------------
export interface LaptopSpecs {
  cpu: string;
  cpu_tier: number; // 1..10 (normalized everyday-performance proxy)
  ram_gb: number;
  storage_gb: number;
  storage_type: "SSD" | "HDD";
  gpu: string;
  gpu_tier: number; // 0 (integrated) .. 10 (high-end dedicated)
  display_inch: number;
  display_resolution: string; // e.g. "1920x1080"
  display_panel: string; // IPS | TN | OLED | VA
  battery_hours: number;
  weight_kg: number;
  os: string;
  release_year: number;
  arabic_keyboard?: boolean;
  upgradeable_ram?: boolean;
  upgradeable_storage?: boolean;
  build_quality?: number; // 1..10 subjective reliability proxy
  ports?: string[];
}

export interface LaptopListing {
  id: string;
  store_name: string;
  product_title: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  availability: string; // "in_stock" | "out_of_stock" | "preorder" | "unknown"
  url?: string | null;
  specs: LaptopSpecs; // parsed from specs_json
  rating?: number | null; // 0..5
  review_count?: number | null;
  source_type: string; // "seed" | "scraped" | "manual"
  last_checked_at?: string | null;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
export interface ScoreBreakdown {
  use_case_fit: number; // each dimension 0..100
  price_performance: number;
  build_reliability: number;
  battery_portability: number;
  display_comfort: number;
  upgradeability: number;
  local_availability: number;
}

export interface ScoredLaptop {
  listing: LaptopListing;
  breakdown: ScoreBreakdown;
  fit_score: number; // 0..100 — how well specs fit the use case
  roi_score: number; // 0..100 — value for money / longevity
  final_score: number; // 0..100 — rubric-weighted overall
  reasons: string[]; // Arabic
  warnings: string[]; // Arabic
}

export type RecommendationType =
  | "best_overall"
  | "best_budget"
  | "best_value"
  | "avoid";

export interface RecommendationResultItem {
  listing_id: string;
  type: RecommendationType;
  fit_score: number;
  roi_score: number;
  final_score: number;
  reasoning: string; // Arabic
  warnings: string[];
}

export interface FinalReport {
  spec: SpecRecommendation;
  scored: ScoredLaptop[]; // all candidates, ranked by final_score desc
  best_overall?: ScoredLaptop;
  best_budget?: ScoredLaptop;
  best_value?: ScoredLaptop;
  avoid?: ScoredLaptop;
  narrative: string; // Arabic final summary
  source: "ai" | "fallback"; // whether the narrative/spec came from AI
}

// ---------------------------------------------------------------------------
// DB row shapes (snake_case, matching Supabase tables)
// ---------------------------------------------------------------------------
export type SessionStatus =
  | "draft"
  | "questions_ready"
  | "answered"
  | "completed"
  | "failed";

export interface RecommendationSessionRow {
  id: string;
  user_id: string;
  status: SessionStatus;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  country: string | null;
  city: string | null;
  primary_use_case: string | null;
  basic_needs_json: BasicNeeds | null;
  spec_json: SpecRecommendation | null;
  report_json: FinalReport | null;
  created_at: string;
  updated_at: string;
}
