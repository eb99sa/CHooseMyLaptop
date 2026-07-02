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

// How the user's location was obtained (or that they skipped it).
export type LocationSource = "browser_geolocation" | "manual_search" | "skipped";

// Approximate location chosen on Page 1. We never persist exact coordinates;
// they are used only transiently during the active request for reverse geocode.
export interface LocationInfo {
  country: string; // "" when skipped
  city_or_area: string; // "" when skipped
  currency: string;
  source: LocationSource;
}

// ---------------------------------------------------------------------------
// Page 1 — Basic structured needs (anonymous)
// ---------------------------------------------------------------------------
export interface BasicNeeds {
  budget_min: number;
  budget_max: number;
  currency: string; // e.g. "KWD"
  country: string; // approximate, may be ""
  city_or_area: string; // approximate, may be ""
  location_source: LocationSource;
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
  display_refresh_hz?: number; // Hz; optional — drives the gaming refresh bonus
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
  image_url?: string | null; // product photo from the store (proxied when rendered)
  country?: string | null;
  city_or_area?: string | null;
  specs: LaptopSpecs; // parsed from specs_json
  rating?: number | null; // 0..5
  review_count?: number | null;
  source_type: string; // "seed" | "scraped" | "manual"
  last_checked_at?: string | null;
}

/**
 * A third-party review attached to a listing (e.g. rtings). Numeric scores may be absent
 * (rtings' numbers are paywalled — we carry only the public qualitative findings, attributed).
 */
export interface ListingReview {
  source_name: string; // "rtings"
  source_url: string | null;
  summary: string;
  pros: string[];
  cons: string[];
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
  // --- Additive (rubric v2). Optional so older persisted reports stay valid. ---
  // Per-dimension data confidence in 0.5..1.0 (1.0 = fully known).
  dim_confidence?: Partial<Record<RubricDimension, number>>;
}

// The seven weighted scoring dimensions (the keys of ScoreBreakdown that feed
// final_score). Used for typed per-use-case weight profiles.
export type RubricDimension =
  | "use_case_fit"
  | "price_performance"
  | "build_reliability"
  | "battery_portability"
  | "display_comfort"
  | "upgradeability"
  | "local_availability";

// A weight profile over the seven dimensions (should sum to ~1.0; normalized at
// runtime to guard float drift).
export type RubricWeights = Record<RubricDimension, number>;

// One sub-engine's output: a 0..100 score plus how confident we are in the data
// it rests on (0.5..1.0). Confidence never inflates the score — it is surfaced
// separately so sparse-but-flattering data can't out-rank rich-but-honest data.
export interface DimensionResult {
  score: number; // 0..100
  confidence: number; // 0.5..1.0
}

export interface ScoredLaptop {
  listing: LaptopListing;
  breakdown: ScoreBreakdown;
  fit_score: number; // 0..100 — how well specs fit the use case
  roi_score: number; // 0..100 — value for money / longevity
  final_score: number; // 0..100 — rubric-weighted overall
  reasons: string[]; // Arabic
  warnings: string[]; // Arabic
  // --- Additive (rubric v2). Optional so older persisted reports stay valid. ---
  data_confidence?: number; // 0..100, use-case-weighted avg of dim confidence
  low_confidence_dims?: RubricDimension[]; // dims resting on uncertain data
  dimension_reasons?: Partial<Record<RubricDimension, string>>; // Arabic, per-dim
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
  | "questions_ready"
  | "answered"
  | "completed"
  | "failed";

// anonymous_recommendation_sessions row. No user/account fields exist.
export interface AnonymousSessionRow {
  id: string;
  session_token_hash: string;
  status: SessionStatus;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  country: string | null;
  city_or_area: string | null;
  location_source: LocationSource;
  primary_use_case: string | null;
  basic_needs_json: BasicNeeds | null;
  answers_json: UserAnswer[] | null;
  ai_followup_questions_json: AIQuestion[] | null;
  recommended_specs_json: SpecRecommendation | null;
  recommendation_result_json: FinalReport | null;
  created_at: string;
  expires_at: string;
}
