// 4Sale (q84sale.com) — Kuwaiti classifieds, the USED market. robots.txt permits listing
// pages; the Next.js app embeds the listings in __NEXT_DATA__ (plain HTTP, no browser).
// Everything here is USED + user-posted, so data is informal and sparse — we filter hard to
// real laptops and mark them with source_type "4sale" (the report flags these as «مستعمل»).

import type { NormalizedListing, StoreAdapter } from "@/lib/scrape/types";
import { ACCESSORY_RE, decodeEntities, guessBrand, looksLikeLaptop, normalizeSpecs } from "@/lib/scrape/specs";

const BASE = "https://www.q84sale.com/en/electronics/laptop-and-computer";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36";
const MAX_PAGES = Number(process.env.SCRAPE_4SALE_LIMIT) || 12; // ~20 listings/page

// Arabic laptop terms (classifieds titles are often Arabic-only).
const LAPTOP_AR = /لابتوب|لاب\s*توب|ماك\s*بوك|نوت\s*بوك|كمبيوتر\s*محمول/;
// Parts / accessories / DESKTOPS to drop (the category mixes them with laptops).
// Only clear standalone PARTS / DESKTOPS — not laptop feature words (a laptop legitimately
// mentions its screen/battery/RAM, so those must NOT be excluders).
const NON_LAPTOP_AR = /شاحن|كيبورد|لوحة\s*مفاتيح|ماوس|حقيب[ةه]|سماع[ةه]|سماعات|مذربورد|اللوحة\s*الأم|كرت\s*شاش[ةه]|رامات|بي\s*سي|كمبيوتر\s*مكتبي|كمبيوتر\s*pc|تاور|قطع\s*غيار|المروح[ةه]/;
const DESKTOP_EN = /\bgaming\s*pc\b|\bdesktop\b|\bpc\s*(tower|case|build|gaming)\b|all[-\s]?in[-\s]?one|\btower\b|\bmotherboard\b/i;

interface FsListing {
  id: number;
  title?: string;
  desc_en?: string;
  desc_ar?: string;
  price?: number;
  slug?: string;
}

function mapListing(l: FsListing): NormalizedListing | null {
  const title = decodeEntities(l.title ?? "");
  const price = typeof l.price === "number" ? l.price : NaN;
  if (!title || !Number.isFinite(price) || price <= 0) return null;
  const text = [title, l.desc_en, l.desc_ar].filter(Boolean).join(" . ");

  // Drop obvious parts/accessories/desktops (English + Arabic); keep only laptop-like items.
  if (ACCESSORY_RE.test(text) || NON_LAPTOP_AR.test(text) || DESKTOP_EN.test(text)) return null;
  const brand = guessBrand(text);
  const specs = normalizeSpecs({ title, brand, text });
  const isLaptop = looksLikeLaptop(text, specs.cpu_tier) || LAPTOP_AR.test(text);
  if (!isLaptop) return null;

  return {
    external_id: String(l.id),
    source_type: "4sale",
    store_name: "4Sale",
    product_title: title,
    brand,
    model: title,
    price: Math.round(price * 1000) / 1000,
    currency: "KWD",
    availability: "in_stock", // a live classified is available
    url: l.slug ? `https://www.q84sale.com/en/listing/${l.slug}` : `https://www.q84sale.com/en/listing/${l.id}`,
    image_url: null,
    country: "Kuwait",
    city_or_area: null,
    rating: null,
    review_count: null,
    specs,
  };
}

async function fetchPage(page: number): Promise<FsListing[]> {
  try {
    const res = await fetch(`${BASE}/${page}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return [];
    const j = JSON.parse(m[1]) as { props?: { pageProps?: { listings?: FsListing[] } } };
    return j.props?.pageProps?.listings ?? [];
  } catch {
    return [];
  }
}

export const foursaleAdapter: StoreAdapter = {
  key: "4sale",
  store_name: "4Sale",
  async fetchListings(): Promise<NormalizedListing[]> {
    const out: NormalizedListing[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const listings = await fetchPage(page);
      if (listings.length === 0) break;
      for (const l of listings) {
        const n = mapListing(l);
        if (n && !seen.has(n.external_id)) {
          seen.add(n.external_id);
          out.push(n);
        }
      }
      await new Promise((r) => setTimeout(r, 500)); // be gentle
    }
    return out;
  },
};
