// Spec normalizer: turn messy store text (title + attributes + tags + body) into
// a scoreable LaptopSpecs. Deterministic + defensive — always returns a valid
// LaptopSpecs (the rubric's data-confidence model tolerates the gaps this leaves).
//
// cpu_tier / gpu_tier use the same 1..10 / 0..10 scales the rest of the app uses
// (see lib/types.ts + the seed catalog), derived by keyword heuristics. Imperfect
// by nature; good enough to rank, and easy to extend with more chip mappings.

import type { LaptopSpecs } from "@/lib/types";
import { BRAND_RELIABILITY, DEFAULT_BRAND_RELIABILITY } from "@/lib/constants";

export interface SpecSignals {
  title: string;
  brand?: string;
  /** key/value attributes from the source (WooCommerce attributes, Shopify tags split). */
  attributes?: Record<string, string>;
  /** any extra free text (description / body_html stripped). */
  text?: string;
  tags?: string[];
}

const CURRENT_YEAR = new Date().getFullYear();

function blob(s: SpecSignals): string {
  const attrs = s.attributes ? Object.entries(s.attributes).map(([k, v]) => `${k}: ${v}`).join(" ") : "";
  return [s.title, attrs, s.tags?.join(" ") ?? "", s.text ?? ""].join(" \n ").toLowerCase();
}

// ---------- CPU ----------
export function cpuTier(text: string): { cpu: string; cpu_tier: number } {
  const t = text.toLowerCase();
  // Apple silicon — only in an actually-Apple context (avoid matching an "M2"
  // SSD slot or a stray "M3" token inside a non-Apple product).
  if (/\bapple\b|macbook/.test(t)) {
    if (/\bm4\s*(max|pro)\b/.test(t)) return { cpu: "Apple M4 Pro/Max", cpu_tier: 10 };
    if (/\bm4\b/.test(t)) return { cpu: "Apple M4", cpu_tier: 9 };
    if (/\bm3\s*(max|pro)\b/.test(t)) return { cpu: "Apple M3 Pro/Max", cpu_tier: 9 };
    if (/\bm3\b/.test(t)) return { cpu: "Apple M3", cpu_tier: 8 };
    if (/\bm2\s*(max|pro)\b/.test(t)) return { cpu: "Apple M2 Pro/Max", cpu_tier: 9 };
    if (/\bm2\b/.test(t)) return { cpu: "Apple M2", cpu_tier: 8 };
    if (/\bm1\s*(max|pro)\b/.test(t)) return { cpu: "Apple M1 Pro/Max", cpu_tier: 8 };
    if (/\bm1\b/.test(t)) return { cpu: "Apple M1", cpu_tier: 7 };
  }

  const highPerf = /\b(hx|hs|\d{4,5}h)\b/.test(t); // mobile high-power suffix
  // Intel Core — match both legacy "Core i7" and the 2024+ "Core 7" / "Ultra 7" naming.
  if (/\bi9\b|core\s*i?9|ultra\s*9/.test(t)) return { cpu: "Intel Core i9", cpu_tier: 9 };
  if (/\bi7\b|core\s*i?7|ultra\s*7/.test(t)) return { cpu: "Intel Core i7", cpu_tier: highPerf ? 8 : 7 };
  if (/\bi5\b|core\s*i?5|ultra\s*5/.test(t)) return { cpu: "Intel Core i5", cpu_tier: highPerf ? 7 : 6 };
  if (/\bi3\b|core\s*i?3|ultra\s*3/.test(t)) return { cpu: "Intel Core i3", cpu_tier: 4 };
  if (/celeron|pentium|\bn\d{3,4}\b|atom/.test(t)) return { cpu: "Intel Celeron/Pentium", cpu_tier: 2 };
  // AMD Ryzen (incl. the new "Ryzen AI" Zen5 + NPU line)
  if (/ryzen\s*ai\s*9/.test(t)) return { cpu: "AMD Ryzen AI 9", cpu_tier: 9 };
  if (/ryzen\s*ai\s*7/.test(t)) return { cpu: "AMD Ryzen AI 7", cpu_tier: 8 };
  if (/ryzen\s*ai\s*5/.test(t)) return { cpu: "AMD Ryzen AI 5", cpu_tier: 7 };
  if (/ryzen\s*9|\br9\b/.test(t)) return { cpu: "AMD Ryzen 9", cpu_tier: 9 };
  if (/ryzen\s*7|\br7\b/.test(t)) return { cpu: "AMD Ryzen 7", cpu_tier: highPerf ? 8 : 7 };
  if (/ryzen\s*5|\br5\b/.test(t)) return { cpu: "AMD Ryzen 5", cpu_tier: highPerf ? 7 : 6 };
  if (/ryzen\s*3|\br3\b/.test(t)) return { cpu: "AMD Ryzen 3", cpu_tier: 4 };
  if (/athlon/.test(t)) return { cpu: "AMD Athlon", cpu_tier: 3 };
  // Snapdragon (Windows on ARM)
  if (/snapdragon\s*x\s*elite/.test(t)) return { cpu: "Snapdragon X Elite", cpu_tier: 8 };
  if (/snapdragon/.test(t)) return { cpu: "Snapdragon", cpu_tier: 6 };

  return { cpu: "غير معروف", cpu_tier: 0 }; // unknown -> 0 (rubric lowers confidence)
}

// ---------- GPU ----------
export function gpuTier(text: string): { gpu: string; gpu_tier: number } {
  const t = text.toLowerCase();
  const rtx = t.match(/rtx\s*([2-5]0[5-9]0)/); // RTX 2050..5090 family digits
  if (rtx) {
    const n = parseInt(rtx[1], 10);
    const last2 = n % 100; // 50,60,70,80,90
    let tier = 4;
    if (last2 >= 90) tier = 10;
    else if (last2 >= 80) tier = 9;
    else if (last2 >= 70) tier = 8;
    else if (last2 >= 60) tier = 7;
    else tier = 5; // x050
    return { gpu: `NVIDIA RTX ${n}`, gpu_tier: tier };
  }
  if (/gtx\s*16[5-6]0/.test(t)) return { gpu: "NVIDIA GTX 1650/1660", gpu_tier: 4 };
  if (/\bmx\s*\d{3}\b/.test(t)) return { gpu: "NVIDIA MX", gpu_tier: 3 };
  if (/radeon\s*rx\s*7\d{3}m|radeon\s*rx\s*6\d{3}m/.test(t)) return { gpu: "AMD Radeon RX (dedicated)", gpu_tier: 6 };
  if (/arc\s*a\d{3}/.test(t)) return { gpu: "Intel Arc", gpu_tier: 4 };
  // Integrated
  if (/iris\s*xe/.test(t)) return { gpu: "Intel Iris Xe", gpu_tier: 2 };
  if (/uhd\s*graphics|intel\s*hd/.test(t)) return { gpu: "Intel UHD Graphics", gpu_tier: 1 };
  if (/radeon\s*graphics|radeon\s*vega/.test(t)) return { gpu: "AMD Radeon Graphics", gpu_tier: 2 };
  if ((/\bapple\b|macbook/.test(t)) && /\bm[1-4]\b/.test(t)) return { gpu: "Apple integrated GPU", gpu_tier: 3 };
  if (/integrated|onboard/.test(t)) return { gpu: "Integrated", gpu_tier: 1 };
  return { gpu: "Integrated", gpu_tier: 1 }; // default assume integrated
}

// ---------- RAM ----------
export function parseRam(text: string): number {
  const t = text.toLowerCase();
  // Prefer an explicit RAM context.
  const ctx = t.match(/(\d{1,3})\s*gb[^.]{0,12}(ram|memory|ذاكرة)/) || t.match(/(ram|memory|ذاكرة)[^.]{0,12}(\d{1,3})\s*gb/);
  if (ctx) {
    const n = parseInt(ctx[1].match(/\d+/) ? ctx[1] : ctx[2], 10);
    if (n >= 2 && n <= 256) return n;
  }
  // Else the first plausible RAM-sized GB value.
  for (const m of t.matchAll(/(\d{1,3})\s*gb/g)) {
    const n = parseInt(m[1], 10);
    if ([4, 8, 12, 16, 24, 32, 36, 48, 64, 96, 128].includes(n)) return n;
  }
  return 0; // unknown
}

// ---------- Storage ----------
export function parseStorage(text: string): { storage_gb: number; storage_type: "SSD" | "HDD" } {
  const t = text.toLowerCase();
  const type: "SSD" | "HDD" = /\bhdd\b|hard\s*disk/.test(t) && !/ssd/.test(t) ? "HDD" : "SSD";
  const tb = t.match(/(\d(?:\.\d)?)\s*tb/);
  if (tb) return { storage_gb: Math.round(parseFloat(tb[1]) * 1024), storage_type: type };
  // GB values that look like storage (>= 128).
  let best = 0;
  for (const m of t.matchAll(/(\d{2,4})\s*gb/g)) {
    const n = parseInt(m[1], 10);
    if ([128, 256, 320, 500, 512, 1000, 1024, 2000, 2048].includes(n) && n > best) best = n;
  }
  return { storage_gb: best || 256, storage_type: type };
}

// ---------- Display ----------
export function parseDisplay(text: string): {
  display_inch: number;
  display_resolution: string;
  display_panel: string;
  display_refresh_hz?: number;
} {
  const t = text.toLowerCase();
  const inchM = t.match(/(1[0-9](?:\.\d)?)\s*(?:["'”]|inch|بوصة|-inch)/);
  const display_inch = inchM ? parseFloat(inchM[1]) : 0;

  let display_resolution = "1920x1080";
  const wh = t.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
  if (wh) display_resolution = `${wh[1]}x${wh[2]}`;
  else if (/\b4k|uhd|3840/.test(t)) display_resolution = "3840x2160";
  else if (/2\.?5k|qhd|1440|2560/.test(t)) display_resolution = "2560x1440";
  else if (/\bfhd|full\s*hd|1080/.test(t)) display_resolution = "1920x1080";
  else if (/\bhd\b|1366/.test(t)) display_resolution = "1366x768";

  const display_panel = /oled/.test(t) ? "OLED" : /\bips\b/.test(t) ? "IPS" : /\bva\b/.test(t) ? "VA" : /\btn\b/.test(t) ? "TN" : "IPS";
  const hz = t.match(/(\d{2,3})\s*hz/);
  const display_refresh_hz = hz ? parseInt(hz[1], 10) : undefined;

  return { display_inch, display_resolution, display_panel, display_refresh_hz };
}

function parseYear(text: string): number {
  const m = text.match(/\b(20[12]\d)\b/);
  const y = m ? parseInt(m[1], 10) : CURRENT_YEAR;
  return y >= 2015 && y <= CURRENT_YEAR ? y : CURRENT_YEAR;
}

/** Size-based weight default when a store doesn't list weight (KW stores rarely do). */
function defaultWeight(inch: number): number {
  if (inch <= 0) return 1.8;
  if (inch <= 14) return 1.5;
  if (inch <= 15.6) return 1.8;
  return 2.2;
}

/**
 * Infer the OS. The old heuristic only flipped to macOS on a literal "macos" token,
 * so every MacBook (title says "MacBook Air M1", not "macOS") was mislabeled Windows.
 * Now: Apple brand / MacBook / Apple-silicon ⇒ macOS; DOS/FreeDOS/no-OS ⇒ "DOS"
 * (a machine that ships without a usable OS); ChromeOS; else Windows.
 */
export function detectOs(text: string, brand = ""): string {
  const t = text.toLowerCase();
  if (
    brand.toLowerCase() === "apple" ||
    /\bmacbook\b|\bimac\b|\bmac\s*(mini|studio|book|pro)\b|mac\s*os|\bmacos\b|\bos\s*x\b/.test(t)
  ) {
    return "macOS";
  }
  if (/chrome\s*os|chromebook/.test(t)) return "ChromeOS";
  if (/free\s*dos|freedos|\bdos\b|no[-\s]+os\b|without\s+os|بدون\s*نظام/.test(t)) return "DOS";
  return "Windows 11";
}

/** Build a full LaptopSpecs from raw store signals. Never throws. */
export function normalizeSpecs(s: SpecSignals): LaptopSpecs {
  const text = blob(s);
  const { cpu, cpu_tier } = cpuTier(text);
  const { gpu, gpu_tier } = gpuTier(text);
  const ram_gb = parseRam(text);
  const { storage_gb, storage_type } = parseStorage(text);
  const display = parseDisplay(text);
  const brand = (s.brand ?? "").toLowerCase();
  const build_quality = BRAND_RELIABILITY[brand] ?? DEFAULT_BRAND_RELIABILITY;
  const battery_match = text.match(/(\d{1,2})\s*(?:hour|hr|ساعة|ساعات)/);
  const weight_match = text.match(/(\d(?:\.\d{1,2})?)\s*kg/);

  return {
    cpu,
    cpu_tier,
    ram_gb,
    storage_gb,
    storage_type,
    gpu,
    gpu_tier,
    display_inch: display.display_inch || 15.6,
    display_resolution: display.display_resolution,
    display_panel: display.display_panel,
    ...(display.display_refresh_hz ? { display_refresh_hz: display.display_refresh_hz } : {}),
    battery_hours: battery_match ? parseInt(battery_match[1], 10) : 6,
    weight_kg: weight_match ? parseFloat(weight_match[1]) : defaultWeight(display.display_inch),
    os: detectOs(text, s.brand ?? ""),
    release_year: parseYear(text),
    arabic_keyboard: /arabic|عربي/.test(text) || undefined,
    build_quality,
  };
}

/** Decode HTML entities that show up in store titles (e.g. 16&#8243; -> 16″). */
export function decodeEntities(s: string): string {
  return (s ?? "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Accessory keywords — used to filter non-laptop items out of broad collections. */
export const ACCESSORY_RE =
  /\b(bag|sleeve|case|charger|adapter|mouse|keyboard|dock|stand|cooling|cooler|warranty|protection|cable|hub|backpack|screen\s*protector|cleaning|stylus|power\s*bank|headset|webcam|sticker|skin|mousepad|mouse\s*pad)\b/i;

/** Non-laptop form factors that carry a CPU and otherwise slip through. */
export const NON_LAPTOP_RE =
  /(legion\s*go|rog\s*ally|steam\s*deck|mini[-\s]*pc|\bmac\s*mini\b|\bimac\b|\bmac\s*studio\b|\bmac\s*pro\b|\bdesktop\b|all[-\s]?in[-\s]?one|\btablet\b|\bipad\b|\btab\s|smart\s*watch|\bphone\b|\bmonitor\b|projector|\bnuc\b|handheld|\bserver\b|\bgpu\b\s*card|graphics\s*card)/i;

/** Heuristic: does this look like an actual laptop (vs. an accessory / other device)? */
export function looksLikeLaptop(title: string, cpu_tier: number, productType = ""): boolean {
  if (ACCESSORY_RE.test(title) || NON_LAPTOP_RE.test(title)) return false;
  // Apple also makes desktops (Mac mini/Studio/Pro, iMac) — among Apple products only
  // MacBooks are laptops, so an Apple/Mac item without "macbook" is not one.
  const t = title.toLowerCase();
  if (/\bapple\b|\bmac\b|\bimac\b/.test(t) && !/\bmacbook\b/.test(t)) return false;
  if (/\b(laptop|notebook|macbook)\b/i.test(title) || /laptop/i.test(productType)) return true;
  return cpu_tier > 0; // a recognizable CPU is strong evidence it's a laptop
}

/** Best-effort brand extraction from a product title. */
export function guessBrand(title: string): string {
  const brands = ["apple", "lenovo", "hp", "dell", "asus", "acer", "msi", "microsoft", "samsung", "huawei", "lg", "gigabyte", "razer", "honor"];
  const t = title.toLowerCase();
  if (/\bmacbook\b|\bimac\b/.test(t)) return "Apple";
  for (const b of brands) if (t.includes(b)) return b.charAt(0).toUpperCase() + b.slice(1);
  return title.trim().split(/\s+/)[0] ?? "";
}
