/**
 * Return the URL only if it is a safe http(s) link, otherwise null. Blocks
 * `javascript:` / `data:` / other scheme injection from any untrusted source
 * (e.g. scraped store/review URLs) before it reaches an href. Use at ingestion
 * AND defensively at render.
 */
export function safeHttpUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}
