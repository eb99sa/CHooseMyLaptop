// X-cite adapter — Kuwait's largest electronics retailer (Next.js). No browser
// needed: each product page embeds the full product as JSON in __NEXT_DATA__, and
// robots.txt permits product pages. Laptop URLs are enumerated from the PDP sitemap.

import type { NormalizedListing, StoreAdapter } from "@/lib/scrape/types";
import { ACCESSORY_RE, decodeEntities, guessBrand, looksLikeLaptop, normalizeSpecs } from "@/lib/scrape/specs";
import { enumerateSitemap, fetchText } from "@/lib/scrape/sitemap";

const PDP_SITEMAP = "https://www.xcite.com/sitemaps/sitemap-pdps.xml";
const LAPTOP_SLUG =
  /(laptop|macbook|thinkpad|ideapad|vivobook|nitro|legion|inspiron|pavilion|zenbook|rog-|tuf-|aspire|probook|elitebook|loq|gram|swift|omen|victus|katana|cyborg|expertbook|chromebook|galaxy-book)/i;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asNum = (v: unknown): number | null => (typeof v === "number" && !Number.isNaN(v) ? v : null);

/** Recursively find the product node: an object with name + price.value + sku. */
function findProduct(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || !isObj(node)) return null;
  const price = node.price;
  if (typeof node.name === "string" && isObj(price) && asNum(price.value) !== null && "sku" in node) {
    return node;
  }
  for (const key of Object.keys(node)) {
    const found = findProduct(node[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function mapPdp(html: string, url: string): NormalizedListing | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const p = findProduct(data);
  if (!p) return null;

  const title = decodeEntities(asStr(p.name));
  const price = isObj(p.price) ? asNum(p.price.value) : null;
  if (!title || price === null || price <= 0) return null;

  const status = asStr(p.status).toLowerCase().replace(/[\s_]/g, "");
  const availability = status.includes("instock")
    ? "in_stock"
    : status.includes("outofstock")
      ? "out_of_stock"
      : "unknown";

  const attributes: Record<string, string> = {};
  const specs = isObj(p.specifications) ? p.specifications.attributes : p.attributes;
  if (Array.isArray(specs)) {
    for (const a of specs) if (isObj(a) && a.label) attributes[asStr(a.label)] = asStr(a.value);
  }
  const brand = attributes["Brand"] || guessBrand(title);
  const normalized = normalizeSpecs({ title, brand, attributes });
  if (!looksLikeLaptop(title, normalized.cpu_tier)) return null;

  const rating = isObj(p.rating) ? asNum(p.rating.average) : asNum(p.rating);
  const reviewCount = isObj(p.rating) ? asNum(p.rating.count) : null;

  return {
    external_id: asStr(p.sku) || url,
    source_type: "xcite",
    store_name: "X-cite",
    product_title: title,
    brand,
    model: title,
    price: Math.round(price * 1000) / 1000,
    currency: "KWD",
    availability,
    url,
    image_url: isObj(p.media) && Array.isArray(p.media) && isObj(p.media[0]) ? asStr((p.media[0] as Record<string, unknown>).url) || null : null,
    country: "Kuwait",
    city_or_area: null,
    rating,
    review_count: reviewCount,
    specs: normalized,
  };
}

export const xciteAdapter: StoreAdapter = {
  key: "xcite",
  store_name: "X-cite",
  async fetchListings(): Promise<NormalizedListing[]> {
    const urls = (
      await enumerateSitemap(PDP_SITEMAP, { filter: LAPTOP_SLUG, maxSubSitemaps: 12, maxUrls: 120 })
    ).filter((u) => !ACCESSORY_RE.test(u)); // skip "laptop-bag"/"-stand"/etc. before fetching
    const out: NormalizedListing[] = [];
    for (const url of urls) {
      const html = await fetchText(url, 25_000);
      if (html) {
        const n = mapPdp(html, url);
        if (n) out.push(n);
      }
      await new Promise((r) => setTimeout(r, 400)); // polite delay between PDPs
    }
    return out;
  },
};
