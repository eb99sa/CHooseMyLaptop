// Small shared helpers. No framework dependencies so this is safe to import
// from both server and client components.

/** Join class names, dropping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Round to a fixed number of decimals (default 0). */
export function round(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// Gulf 3-decimal (fils) currencies; everything else formats to 2 decimals.
const THREE_DECIMAL_CURRENCIES = new Set(["KWD", "BHD", "OMR"]);

/** Format a price with its currency, with currency-correct decimal precision. */
export function formatPrice(amount: number, currency = "KWD"): string {
  if (!Number.isFinite(amount)) return `— ${currency}`;
  const decimals = THREE_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 3 : 2;
  const value = Number.isInteger(amount) ? amount.toString() : amount.toFixed(decimals);
  return `${value} ${currency}`;
}

/** Parse JSON without throwing; returns fallback on failure. */
export function safeJsonParse<T>(input: unknown, fallback: T): T {
  if (input == null) return fallback;
  if (typeof input === "object") return input as T;
  if (typeof input !== "string") return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

/**
 * Extract the first JSON object/array from a model response.
 * LLMs sometimes wrap JSON in ```json fences or add prose; this is tolerant.
 */
export function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^﻿/, "")
    .replace(/```json/gi, "```")
    .trim();

  // Try direct parse first.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to bracket extraction
  }

  // Find the outermost {...} or [...] block. Try whichever opening bracket
  // appears first so a top-level array isn't mis-read as an inner object.
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  const arrayFirst = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
  const candidates: Array<[string, string]> = arrayFirst
    ? [
        ["[", "]"],
        ["{", "}"],
      ]
    : [
        ["{", "}"],
        ["[", "]"],
      ];
  for (const [open, close] of candidates) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start !== -1 && end !== -1 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(slice) as T;
      } catch {
        // keep trying
      }
    }
  }
  return null;
}

/** Format an ISO date as a short readable Arabic-locale string. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Escape a value for inclusion in a CSV cell. */
export function csvCell(value: unknown): string {
  if (value == null) return "";
  let s: string;
  if (typeof value === "object") {
    s = JSON.stringify(value);
  } else {
    s = String(value);
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from headers + rows of records. */
export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const head = headers.map(csvCell).join(",");
  const body = rows
    .map((row) => headers.map((h) => csvCell(row[h])).join(","))
    .join("\r\n");
  // Prepend BOM so Excel reads UTF-8 (Arabic) correctly.
  return `﻿${head}\r\n${body}`;
}
