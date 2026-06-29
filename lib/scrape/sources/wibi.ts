// Wibi adapter — Shopify native products.json (no auth, read-only).
// GET /collections/all-laptops/products.json?limit=250&page=N

import type { NormalizedListing, StoreAdapter } from "@/lib/scrape/types";
import { decodeEntities, guessBrand, looksLikeLaptop, normalizeSpecs } from "@/lib/scrape/specs";

const COLLECTION = "https://wibi.com.kw/collections/all-laptops/products.json";

interface ShopifyVariant { price?: string; sku?: string; available?: boolean }
interface ShopifyProduct {
  id: number;
  title?: string;
  handle?: string;
  vendor?: string;
  body_html?: string;
  tags?: string[];
  product_type?: string;
  variants?: ShopifyVariant[];
  images?: Array<{ src?: string }>;
}

function stripHtml(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}

// Shopify products.json prices are decimal strings in major units (e.g. "315.490").
// Guard the rare integer-minor-units case defensively.
function parsePrice(raw: string | undefined): number {
  if (!raw) return NaN;
  if (raw.includes(".")) return parseFloat(raw);
  const n = parseInt(raw, 10);
  return n > 1000 ? n / 1000 : n; // looks like fils -> KWD
}

function mapProduct(p: ShopifyProduct): NormalizedListing | null {
  const title = decodeEntities(p.title ?? "");
  if (!title) return null;
  const variant = p.variants?.[0];
  const price = parsePrice(variant?.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const brand = p.vendor?.trim() || guessBrand(title);
  const available = (p.variants ?? []).some((v) => v.available);
  // Shopify tags like "Memory: 16GB" become attributes; loose tags stay as tags.
  const attributes: Record<string, string> = {};
  const looseTags: string[] = [];
  for (const tag of p.tags ?? []) {
    const m = tag.match(/^\s*([^:]+):\s*(.+)$/);
    if (m) attributes[m[1].trim()] = m[2].trim();
    else looseTags.push(tag);
  }

  const specs = normalizeSpecs({ title, brand, attributes, tags: looseTags, text: stripHtml(p.body_html) });
  // The "all-laptops" collection also carries accessories/variants — keep laptops only.
  if (!looksLikeLaptop(title, specs.cpu_tier, p.product_type)) return null;

  return {
    external_id: p.handle || String(p.id),
    source_type: "wibi",
    store_name: "Wibi",
    product_title: title,
    brand,
    model: title,
    price: Math.round(price * 1000) / 1000,
    currency: "KWD",
    availability: available ? "in_stock" : "out_of_stock",
    url: p.handle ? `https://wibi.com.kw/products/${p.handle}` : null,
    image_url: p.images?.[0]?.src ?? null,
    country: "Kuwait",
    city_or_area: null,
    rating: null,
    review_count: null,
    specs,
  };
}

export const wibiAdapter: StoreAdapter = {
  key: "wibi",
  store_name: "Wibi",
  async fetchListings(): Promise<NormalizedListing[]> {
    const out: NormalizedListing[] = [];
    for (let page = 1; page <= 10; page++) {
      try {
        const res = await fetch(`${COLLECTION}?limit=250&page=${page}`, {
          headers: { Accept: "application/json", "User-Agent": "CHooseMyLaptop/1.0 (+catalog sync)" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          console.warn(`[wibi] page ${page} HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as { products?: ShopifyProduct[] };
        const products = data.products ?? [];
        if (products.length === 0) break; // no more pages
        for (const p of products) {
          const n = mapProduct(p);
          if (n) out.push(n);
        }
        if (products.length < 250) break; // last page
      } catch (err) {
        console.warn(`[wibi] page ${page} failed:`, (err as Error).message);
        break;
      }
    }
    // Collapse the many color/config variants down to one row per distinct
    // (brand + core specs), keeping the cheapest in-stock offer for each.
    const byKey = new Map<string, NormalizedListing>();
    for (const l of out) {
      const s = l.specs;
      const key = [l.brand.toLowerCase(), s.cpu_tier, s.ram_gb, s.storage_gb, s.gpu_tier, Math.round(s.display_inch)].join("|");
      const cur = byKey.get(key);
      if (!cur) {
        byKey.set(key, l);
        continue;
      }
      const lInStock = l.availability === "in_stock";
      const curInStock = cur.availability === "in_stock";
      const better = (lInStock && !curInStock) || (lInStock === curInStock && l.price < cur.price);
      if (better) byKey.set(key, l);
    }
    return [...byKey.values()];
  },
};
