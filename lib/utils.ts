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

/** Format a price with its currency, Arabic-friendly. */
export function formatPrice(amount: number, currency = "KWD"): string {
  const value = Number.isInteger(amount) ? amount.toString() : amount.toFixed(3);
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

  // Find the outermost {...} or [...] block.
  const candidates: Array<[string, string]> = [
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

/** Check whether an email is in the admin allow-list (env: ADMIN_EMAILS). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const allow = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
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
