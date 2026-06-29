// Best Al-Yousifi adapter — SAP Commerce (Hybris). The storefront is a heavy SPA
// behind Cloudflare, but it loads products from an OPEN OCC JSON API on a separate
// host (mrflex.best.com.kw) that answers plain HTTP — so no browser needed.

import type { NormalizedListing, StoreAdapter } from "@/lib/scrape/types";
import { decodeEntities, guessBrand, looksLikeLaptop, normalizeSpecs } from "@/lib/scrape/specs";

const API = "https://mrflex.best.com.kw/occ/v2/best/products/search";
const FIELDS =
  "products(name,code,url,price(DEFAULT),stock(DEFAULT),description,manufacturer,averageRating,numberOfReviews),pagination(DEFAULT)";
const CATEGORIES = ["laptops", "gaminglaptops", "macbooks"];

interface BestProduct {
  name?: string;
  code?: string;
  url?: string;
  price?: { value?: number };
  stock?: { stockLevelStatus?: string };
  description?: string;
  manufacturer?: string;
  averageRating?: number;
  numberOfReviews?: number;
}

function brandFromMfr(m: string): string {
  if (/^[A-Z]{2,4}$/.test(m)) return m; // HP, MSI, LG, ACER stays as-is
  return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
}

function mapProduct(p: BestProduct): NormalizedListing | null {
  const title = decodeEntities(p.name ?? "");
  const price = typeof p.price?.value === "number" ? p.price.value : NaN;
  if (!title || !Number.isFinite(price) || price <= 0) return null;

  const status = (p.stock?.stockLevelStatus ?? "").toLowerCase();
  const availability =
    status.includes("instock") || status.includes("lowstock")
      ? "in_stock"
      : status.includes("outofstock")
        ? "out_of_stock"
        : "unknown";

  const brand = p.manufacturer ? brandFromMfr(p.manufacturer) : guessBrand(title);
  const specs = normalizeSpecs({ title, brand, text: p.description ?? "" });
  if (!looksLikeLaptop(title, specs.cpu_tier)) return null;

  const url = p.url ? (p.url.startsWith("http") ? p.url : `https://best.com.kw${p.url}`) : null;
  return {
    external_id: p.code || url || title,
    source_type: "best",
    store_name: "Best Al-Yousifi",
    product_title: title,
    brand,
    model: title,
    price: Math.round(price * 1000) / 1000,
    currency: "KWD",
    availability,
    url,
    image_url: null,
    country: "Kuwait",
    city_or_area: null,
    rating: typeof p.averageRating === "number" && p.averageRating > 0 ? p.averageRating : null,
    review_count: typeof p.numberOfReviews === "number" && p.numberOfReviews > 0 ? p.numberOfReviews : null,
    specs,
  };
}

export const bestAdapter: StoreAdapter = {
  key: "best",
  store_name: "Best Al-Yousifi",
  async fetchListings(): Promise<NormalizedListing[]> {
    const out: NormalizedListing[] = [];
    for (const cat of CATEGORIES) {
      let page = 0;
      let totalPages = 1;
      do {
        const url = `${API}?query=${encodeURIComponent(`:relevance:allCategories:${cat}`)}&pageSize=100&currentPage=${page}&lang=en&curr=KWD&fields=${encodeURIComponent(FIELDS)}`;
        try {
          const res = await fetch(url, {
            headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36" },
            signal: AbortSignal.timeout(20_000),
          });
          if (!res.ok) {
            console.warn(`[best] ${cat} p${page} HTTP ${res.status}`);
            break;
          }
          const data = (await res.json()) as { products?: BestProduct[]; pagination?: { totalPages?: number } };
          for (const p of data.products ?? []) {
            const n = mapProduct(p);
            if (n) out.push(n);
          }
          totalPages = data.pagination?.totalPages ?? 1;
        } catch (err) {
          console.warn(`[best] ${cat} p${page} failed:`, (err as Error).message);
          break;
        }
        page++;
      } while (page < totalPages && page < 10);
    }
    // De-dupe across categories by product code.
    const seen = new Set<string>();
    return out.filter((l) => (seen.has(l.external_id) ? false : (seen.add(l.external_id), true)));
  },
};
