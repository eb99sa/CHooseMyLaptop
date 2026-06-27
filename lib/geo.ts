// Location helpers: map a country (ISO code) to a sensible default currency,
// and a small set of country-name fallbacks. Defaults to KWD (the home market).

export const CURRENCY_BY_COUNTRY_CODE: Record<string, string> = {
  kw: "KWD", // Kuwait
  sa: "SAR", // Saudi Arabia
  ae: "AED", // United Arab Emirates
  qa: "QAR", // Qatar
  bh: "BHD", // Bahrain
  om: "OMR", // Oman
  eg: "EGP", // Egypt
  jo: "JOD", // Jordan
  us: "USD",
  gb: "GBP",
};

export const SUPPORTED_CURRENCIES = [
  "KWD",
  "SAR",
  "AED",
  "QAR",
  "BHD",
  "OMR",
  "USD",
];

/** Currency for an ISO 3166-1 alpha-2 country code (Mapbox `short_code`). */
export function currencyForCountryCode(code: string | null | undefined): string {
  if (!code) return "KWD";
  return CURRENCY_BY_COUNTRY_CODE[code.toLowerCase()] ?? "KWD";
}

/** Join area + country into a short readable label, skipping empty parts. */
export function formatArea(
  cityOrArea: string | null | undefined,
  country: string | null | undefined,
): string {
  return [cityOrArea, country].filter((p) => p && p.trim()).join("، ");
}
