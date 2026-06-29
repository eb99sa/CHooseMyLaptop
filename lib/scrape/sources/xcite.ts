// X-cite adapter — Kuwait's largest electronics retailer. Its storefront search is
// powered by Algolia via an open proxy (POST /api/algolia/proxy) that answers plain
// HTTP — no browser, no sitemap crawl. We query the laptops category index and
// paginate. The category is passed as the Algolia `query` (that's how X-cite does it).

import type { NormalizedListing, StoreAdapter } from "@/lib/scrape/types";
import { decodeEntities, guessBrand, looksLikeLaptop, normalizeSpecs } from "@/lib/scrape/specs";

const PROXY = "https://www.xcite.com/api/algolia/proxy";
const INDEX = "xcite_prod_kw_en_main";
const LAPTOP_CATEGORY_ID = "6290bd82-7efb-4e77-a6b9-3e4334a3db35"; // /laptops/c

interface XciteHit {
  objectType?: string;
  name?: string;
  slug?: string;
  price?: number;
  currency?: string;
  ctId?: string;
  inStock?: boolean;
  stockStatus?: string;
  availability?: string;
  averageRating?: number;
  rating?: number;
  reviewsCount?: number;
}

function mapHit(h: XciteHit): NormalizedListing | null {
  if (h.objectType && h.objectType !== "product") return null;
  const title = decodeEntities(h.name ?? "");
  const price = typeof h.price === "number" ? h.price : NaN;
  if (!title || !Number.isFinite(price) || price <= 0) return null;

  const brand = guessBrand(title);
  const specs = normalizeSpecs({ title, brand });
  if (!looksLikeLaptop(title, specs.cpu_tier)) return null;

  const status = `${h.stockStatus ?? ""}${h.availability ?? ""}`.toLowerCase();
  const availability = h.inStock === false || status.includes("out") ? "out_of_stock" : "in_stock";
  const rating = typeof h.averageRating === "number" ? h.averageRating : typeof h.rating === "number" ? h.rating : null;

  return {
    external_id: h.ctId || h.slug || title,
    source_type: "xcite",
    store_name: "X-cite",
    product_title: title,
    brand,
    model: title,
    price: Math.round(price * 1000) / 1000,
    currency: "KWD",
    availability,
    url: h.slug ? `https://www.xcite.com/${h.slug}/p` : null,
    image_url: null,
    country: "Kuwait",
    city_or_area: null,
    rating: rating && rating > 0 ? rating : null,
    review_count: typeof h.reviewsCount === "number" && h.reviewsCount > 0 ? h.reviewsCount : null,
    specs,
  };
}

export const xciteAdapter: StoreAdapter = {
  key: "xcite",
  store_name: "X-cite",
  async fetchListings(): Promise<NormalizedListing[]> {
    const out: NormalizedListing[] = [];
    for (let page = 0; page < 12; page++) {
      const body = JSON.stringify({
        requests: [
          {
            indexName: INDEX,
            params: { hitsPerPage: 100, page, query: LAPTOP_CATEGORY_ID, facets: ["*"], maxValuesPerFacet: 1000 },
          },
        ],
        operation: "search",
      });
      try {
        const res = await fetch(PROXY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36",
          },
          body,
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          console.warn(`[xcite] page ${page} HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as { results?: Array<{ hits?: XciteHit[]; nbPages?: number }> };
        const result = data.results?.[0];
        for (const h of result?.hits ?? []) {
          const n = mapHit(h);
          if (n) out.push(n);
        }
        if (page + 1 >= (result?.nbPages ?? 1)) break;
      } catch (err) {
        console.warn(`[xcite] page ${page} failed:`, (err as Error).message);
        break;
      }
    }
    const seen = new Set<string>();
    return out.filter((l) => (seen.has(l.external_id) ? false : (seen.add(l.external_id), true)));
  },
};
