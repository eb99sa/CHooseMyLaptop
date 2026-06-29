// Sitemap helpers for the HTML-based store adapters. Fetches with a normal
// browser UA (some KW retail sites filter non-browser agents). Offline use only.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** GET text with a browser UA. Returns null on any failure (never throws). */
export async function fetchText(url: string, timeoutMs = 20_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml,application/xml,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

export interface SitemapOpts {
  filter?: RegExp; // keep only URLs matching this
  maxSubSitemaps?: number; // for a sitemap index, how many children to scan
  maxUrls?: number; // cap the returned URLs
}

/**
 * Enumerate product URLs from a sitemap or sitemap-index, filtered + capped.
 * Recurses one level into a <sitemapindex>.
 */
export async function enumerateSitemap(url: string, opts: SitemapOpts = {}): Promise<string[]> {
  const xml = await fetchText(url, 25_000);
  if (!xml) return [];
  const keep = (u: string) => (opts.filter ? opts.filter.test(u) : true);

  if (/<sitemapindex/i.test(xml)) {
    const subs = extractLocs(xml).slice(0, opts.maxSubSitemaps ?? 5);
    const out: string[] = [];
    for (const sub of subs) {
      const subXml = await fetchText(sub, 25_000);
      if (!subXml) continue;
      for (const u of extractLocs(subXml)) if (keep(u)) out.push(u);
      if (opts.maxUrls && out.length >= opts.maxUrls) break;
    }
    return opts.maxUrls ? out.slice(0, opts.maxUrls) : out;
  }

  const filtered = extractLocs(xml).filter(keep);
  return opts.maxUrls ? filtered.slice(0, opts.maxUrls) : filtered;
}
