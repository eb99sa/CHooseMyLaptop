import type {
  AnswerType,
  BasicNeeds,
  ConditionPref,
  Importance,
  LocationSource,
  ScreenSizePref,
  UseCase,
  Urgency,
  UserAnswer,
} from "@/lib/types";

const USE_CASES: UseCase[] = [
  "teaching",
  "university",
  "office",
  "programming",
  "design",
  "engineering",
  "gaming",
  "video_editing",
  "business",
  "family",
];
const IMPORTANCE: Importance[] = ["very_important", "somewhat", "not_important"];
const SCREEN: ScreenSizePref[] = ["small", "medium", "large", "no_pref"];
const CONDITION: ConditionPref[] = ["new", "used", "either"];
const URGENCY: Urgency[] = ["now", "soon", "can_wait"];
const LOCATION_SOURCES: LocationSource[] = [
  "browser_geolocation",
  "manual_search",
  "skipped",
];
const ANSWER_TYPES: AnswerType[] = [
  "text",
  "number",
  "boolean",
  "single_select",
  "multi_select",
];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function toNum(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? parseFloat(value) : (value as number);
  return typeof n === "number" && !Number.isNaN(n) ? n : fallback;
}

/** Validate + normalize a Page 1 payload. Returns null if unusable. */
export function normalizeBasicNeeds(input: unknown): BasicNeeds | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;

  const budget_max = toNum(b.budget_max, 0);
  if (budget_max <= 0) return null;
  if (!USE_CASES.includes(b.primary_use_case as UseCase)) return null;

  let budget_min = toNum(b.budget_min, Math.round(budget_max * 0.6));
  if (budget_min < 0) budget_min = 0;
  if (budget_min > budget_max) budget_min = Math.round(budget_max * 0.6);

  return {
    budget_min,
    budget_max,
    currency: typeof b.currency === "string" && b.currency ? b.currency.trim().slice(0, 8) : "KWD",
    country: typeof b.country === "string" ? b.country.slice(0, 80) : "",
    city_or_area: typeof b.city_or_area === "string" ? b.city_or_area.slice(0, 120) : "",
    location_source: pick(b.location_source, LOCATION_SOURCES, "skipped"),
    primary_use_case: b.primary_use_case as UseCase,
    portability: pick(b.portability, IMPORTANCE, "somewhat"),
    battery_importance: pick(b.battery_importance, IMPORTANCE, "somewhat"),
    screen_size_pref: pick(b.screen_size_pref, SCREEN, "no_pref"),
    needs_arabic_keyboard: Boolean(b.needs_arabic_keyboard),
    condition_pref: pick(b.condition_pref, CONDITION, "either"),
    preferred_stores: typeof b.preferred_stores === "string" ? b.preferred_stores.slice(0, 200) : undefined,
    urgency: pick(b.urgency, URGENCY, "soon"),
  };
}

/** Validate + normalize a Page 2 answers payload. */
export function normalizeAnswers(input: unknown): UserAnswer[] {
  if (!input) return [];
  const arr = Array.isArray(input)
    ? input
    : Array.isArray((input as Record<string, unknown>).answers)
      ? ((input as Record<string, unknown>).answers as unknown[])
      : [];
  const out: UserAnswer[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const key = typeof a.question_key === "string" ? a.question_key : "";
    if (!key) continue;
    let value: string;
    if (Array.isArray(a.answer_value)) value = JSON.stringify(a.answer_value);
    else value = a.answer_value == null ? "" : String(a.answer_value);
    value = value.slice(0, 500);
    out.push({
      question_key: key,
      question_text: typeof a.question_text === "string" ? a.question_text : "",
      answer_value: value,
      answer_type: ANSWER_TYPES.includes(a.answer_type as AnswerType)
        ? (a.answer_type as AnswerType)
        : "text",
    });
  }
  return out;
}
