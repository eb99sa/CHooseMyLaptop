// rtings.com source — pulls PUBLIC qualitative review findings from rtings' open review API.
//
// Ethics/legitimacy: rtings' robots.txt permits crawling review pages (only /user_reviews/
// and /admin/ are disallowed), and their review JSON API answers plain HTTP. Their NUMERIC
// scores are paywalled ("insider_only" → null in the public API) and we DO NOT attempt to
// access them. What IS public is the qualitative test prose (build quality, display, battery,
// ports…) and we use only that, ATTRIBUTED to rtings, as RAG grounding. Direct HTTP, no browser.

const API = "https://www.rtings.com/api/v2/safe/app/product_vue_page__page_body";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36";

export interface RtingsReview {
  url: string;
  fullname: string; // "Apple MacBook Air 13 (M4, 2025)"
  brand: string; // "Apple"
  model_family: string; // "macbook air 13" — brand/year/paren stripped, for catalog matching
  skus: string[];
  findings: Array<{ name: string; text: string }>; // public qualitative test descriptions
}

const strip = (s: string): string => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** "Apple MacBook Air 13 (M4, 2025)" + "Apple" -> "macbook air 13" */
export function modelFamilyKey(fullname: string, brand: string): string {
  return fullname
    .toLowerCase()
    .replace(brand.toLowerCase(), "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b20[12]\d\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** All laptop review URL paths from rtings' sitemap (excludes best-of / tools pages). */
export async function fetchRtingsReviewUrls(): Promise<string[]> {
  try {
    const res = await fetch("https://www.rtings.com/sitemap.xml", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const urls = [...xml.matchAll(/\/laptop\/reviews\/[a-z0-9-]+\/[a-z0-9-]+/g)].map((m) => m[0]);
    return [...new Set(urls)].filter((u) => !/\/best\/|\/tools|\/by-usage/.test(u));
  } catch {
    return [];
  }
}

/** Fetch one review's PUBLIC data via the open API. Paywalled numeric scores are ignored. */
export async function fetchRtingsReview(urlPath: string): Promise<RtingsReview | null> {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
      body: JSON.stringify({ variables: { url: urlPath, named_version: "public", version_id: null }, share_token: null, url_path: urlPath }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const p = (await res.json())?.data?.page?.product;
    if (!p?.fullname) return null;
    const brand: string = p.brand?.name ?? "";
    const findings = ((p.review?.test_results ?? []) as Array<{ test?: { featured_name?: string; name?: string }; linked_description?: string }>)
      .map((t) => ({ name: strip(t.test?.featured_name || t.test?.name || ""), text: strip(t.linked_description || "") }))
      .filter((f) => f.name && f.text.length > 30);
    const skus = ((p.skus ?? []) as Array<{ fullname?: string; name?: string }>).map((s) => s.fullname || s.name || "").filter(Boolean);
    return { url: `https://www.rtings.com${urlPath}`, fullname: p.fullname, brand, model_family: modelFamilyKey(p.fullname, brand), skus, findings };
  } catch {
    return null;
  }
}
