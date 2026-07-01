// Presentation helpers: turn raw specs into PLAIN-MEANING bars (what each spec does for you)
// and a clean laptop name. Keeps the report human; the tech detail stays available but secondary.

import type { LaptopSpecs, SpecTarget } from "@/lib/types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const log = (n: number, base: number) => Math.log2(Math.max(1, n)) / Math.log2(base);

export interface SpecMeter {
  key: string;
  label: string; // what the spec MEANS (not "CPU")
  level: number; // 0..100 bar fill
  value: string; // the tech detail (secondary)
}

/** Benefit meters for a laptop — each spec labelled by what it gives the user, with a 0..100 bar. */
export function specMeters(s: LaptopSpecs): SpecMeter[] {
  return [
    { key: "power", label: "القوة والسرعة", level: clamp(s.cpu_tier * 10), value: s.cpu },
    { key: "multitask", label: "تعدّد المهام", level: clamp(log(s.ram_gb, 64) * 100), value: `${s.ram_gb}GB` },
    { key: "space", label: "مساحة التخزين", level: clamp(log(s.storage_gb / 128, 16) * 100), value: `${s.storage_gb}GB ${s.storage_type}` },
    { key: "graphics", label: "الألعاب والرسوميات", level: clamp(s.gpu_tier * 10), value: s.gpu },
    { key: "screen", label: "حجم الشاشة", level: clamp(((s.display_inch - 11) / 6.3) * 100), value: `${s.display_inch}″` },
    { key: "battery", label: "عمر البطارية", level: clamp((s.battery_hours / 12) * 100), value: `${s.battery_hours} ساعات` },
  ];
}

/**
 * A plain rating word for a 0..100 level — what a non-technical buyer reads at a
 * glance ("gaming power: ممتاز"). No numbers, no jargon.
 */
export function tierWord(level: number): string {
  if (level >= 82) return "ممتاز";
  if (level >= 64) return "جيد جدًا";
  if (level >= 45) return "جيد";
  if (level >= 28) return "مقبول";
  return "محدود";
}

/**
 * The TECHNICAL details — component names, GB, GPU model, integrated-vs-dedicated.
 * These live behind the flip (for tech-savvy users); the front never shows them.
 */
export function techSpecs(s: LaptopSpecs): { label: string; value: string }[] {
  const gpu = !s.gpu || s.gpu.toLowerCase() === "integrated" ? "كرت مدمج" : s.gpu;
  return [
    { label: "المعالج", value: s.cpu },
    { label: "الذاكرة", value: `${s.ram_gb}GB` },
    { label: "التخزين", value: `${s.storage_gb}GB ${s.storage_type}` },
    { label: "كرت الشاشة", value: gpu },
    { label: "الشاشة", value: `${s.display_inch}"${s.display_panel ? ` ${s.display_panel}` : ""}` },
    { label: "البطارية", value: `${s.battery_hours} ساعات` },
    { label: "الوزن", value: `${s.weight_kg} كجم` },
    { label: "نظام التشغيل", value: s.os },
  ];
}

/** Plain "what you need" highlights derived from the recommended (ideal) spec target. */
export function needHighlights(ideal: SpecTarget): string[] {
  const out: string[] = [];
  out.push(
    ideal.cpu_tier >= 8 ? "أداء قوي للمهام الثقيلة" : ideal.cpu_tier >= 6 ? "أداء جيد للاستخدام اليومي" : "أداء كافٍ للأساسيات",
  );
  out.push(ideal.ram_gb >= 16 ? `ذاكرة ${ideal.ram_gb}GB مريحة لتعدّد المهام` : "ذاكرة مناسبة للمهام البسيطة");
  if (ideal.gpu && ideal.gpu !== "integrated") out.push("كرت شاشة مخصّص للألعاب أو التصميم");
  out.push(ideal.storage_gb >= 1024 ? "مساحة تخزين واسعة" : "مساحة تخزين مناسبة");
  out.push(ideal.battery_hours_min >= 8 ? "بطارية تكفي يوماً كاملاً" : "بطارية ليوم عمل");
  return out;
}

/**
 * A clean, general laptop name — drops the spec soup that's already shown as bars (CPU/RAM/SSD/
 * inch/color/SKU), leaving just the model. "Lenovo IdeaPad Slim 5 Laptop, Intel Core i5, 16GB,
 * 512GB SSD, 83HR006NAX - Blue" → "Lenovo IdeaPad Slim 5".
 */
export function shortLaptopName(title: string): string {
  let t = (title || "").split(/\s*[,،|]\s*|\s+[-–]\s+/)[0]; // cut at comma / spaced dash
  t = t.split(/\b(?:intel|amd|apple\s*m\d|core\s+(?:i\d|ultra)|ryzen|snapdragon|celeron|pentium|\d+\s*gb|\d{3,4}\s*(?:ssd|hdd)|\d{2}(?:\.\d)?\s*(?:inch|بوصة)|["”″])/i)[0];
  t = t.replace(/\b(laptop|notebook|gaming|convertible|2-?in-?1|ultrabook|chromebook)\b/gi, " ").replace(/\s{2,}/g, " ").trim();
  return t || title;
}
