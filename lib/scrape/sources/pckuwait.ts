// PCKuwait adapter — public WooCommerce Store API v1 (no auth, clean JSON).
// GET /wp-json/wc/store/v1/products?category=<id>&per_page=100
//   306 = laptop, 688 = gaming-laptop (stable WooCommerce category ids).

import type { NormalizedListing, StoreAdapter } from "@/lib/scrape/types";
import { decodeEntities, guessBrand, normalizeSpecs } from "@/lib/scrape/specs";

const BASE = "https://pckuwait.com/wp-json/wc/store/v1/products";
const CATEGORIES = [306, 688];

interface WooTerm { name?: string }
interface WooAttribute { name?: string; terms?: WooTerm[] }
interface WooProduct {
  id: number;
  name?: string;
  permalink?: string;
  sku?: string;
  prices?: { price?: string; currency_minor_unit?: number };
  is_in_stock?: boolean;
  attributes?: WooAttribute[];
  images?: Array<{ src?: string }>;
  short_description?: string;
  description?: string;
}

function stripHtml(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}

function mapProduct(p: WooProduct): NormalizedListing | null {
  const title = decodeEntities(p.name ?? "");
  if (!title) return null;

  const minor = p.prices?.currency_minor_unit ?? 3;
  const price = p.prices?.price ? parseInt(p.prices.price, 10) / 10 ** minor : NaN;
  if (!Number.isFinite(price) || price <= 0) return null;

  const attributes: Record<string, string> = {};
  for (const a of p.attributes ?? []) {
    if (a.name) attributes[a.name] = (a.terms ?? []).map((t) => t.name).filter(Boolean).join(", ");
  }
  const brand =
    attributes["Brand"] || attributes["brand"] || guessBrand(title);

  return {
    external_id: p.sku || String(p.id),
    source_type: "pckuwait",
    store_name: "PCKuwait",
    product_title: title,
    brand,
    model: title,
    price: Math.round(price * 1000) / 1000,
    currency: "KWD",
    availability: p.is_in_stock ? "in_stock" : "out_of_stock",
    url: p.permalink ?? null,
    image_url: p.images?.[0]?.src ?? null,
    country: "Kuwait",
    city_or_area: null,
    rating: null,
    review_count: null,
    specs: normalizeSpecs({ title, brand, attributes, text: stripHtml(p.short_description) + " " + stripHtml(p.description) }),
  };
}

export const pckuwaitAdapter: StoreAdapter = {
  key: "pckuwait",
  store_name: "PCKuwait",
  async fetchListings(): Promise<NormalizedListing[]> {
    const out: NormalizedListing[] = [];
    for (const cat of CATEGORIES) {
      try {
        const res = await fetch(`${BASE}?category=${cat}&per_page=100`, {
          headers: { Accept: "application/json", "User-Agent": "CHooseMyLaptop/1.0 (+catalog sync)" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          console.warn(`[pckuwait] category ${cat} HTTP ${res.status}`);
          continue;
        }
        const products = (await res.json()) as WooProduct[];
        if (Array.isArray(products)) {
          for (const p of products) {
            const n = mapProduct(p);
            if (n) out.push(n);
          }
        }
      } catch (err) {
        console.warn(`[pckuwait] category ${cat} failed:`, (err as Error).message);
      }
    }
    // De-dupe by external_id (a product can appear in both categories).
    const seen = new Set<string>();
    return out.filter((l) => (seen.has(l.external_id) ? false : (seen.add(l.external_id), true)));
  },
};
