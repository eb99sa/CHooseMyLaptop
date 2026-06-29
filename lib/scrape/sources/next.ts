// Next Computer Store (nextstore.com.kw) adapter — Magento 2. The sitemap +
// product pages are GEO-BLOCKED (HTTP 403) to non-Kuwait IPs, so this must run
// from a Kuwaiti connection. Clever bit: the product URL SLUG already encodes the
// specs (brand-model-cpu-ram-storage-gpu-display-os), so specs come from the URL;
// only PRICE + availability need the live page (multi-strategy Magento extraction).

import type { NormalizedListing, StoreAdapter } from "@/lib/scrape/types";
import { ACCESSORY_RE, decodeEntities, guessBrand, looksLikeLaptop, normalizeSpecs } from "@/lib/scrape/specs";
import { enumerateSitemap, fetchText } from "@/lib/scrape/sitemap";

const SITEMAP = "https://www.nextstore.com.kw/sitemap_index.xml";
// A laptop slug carries "<n>gb-ram" + a storage type — accessories/monitors don't.
const LAPTOP_SLUG = /\d+gb-ram/i;
const STORAGE_RE = /(ssd|hdd|emmc|nvme)/i;

function slugFrom(url: string): string {
  const last = url.split("/").pop() ?? url;
  return last.replace(/\.html$/i, "").replace(/-/g, " ");
}

function extractPrice(html: string): number | null {
  // 1) schema.org JSON-LD offers.price
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j: unknown = JSON.parse(m[1]);
      const nodes = Array.isArray(j) ? j : [j];
      for (const node of nodes) {
        const offers = (node as { offers?: unknown }).offers;
        const off = Array.isArray(offers) ? offers[0] : offers;
        const price = off && typeof off === "object" ? (off as { price?: unknown }).price : undefined;
        const n = parseFloat(String(price));
        if (Number.isFinite(n) && n > 0) return n;
      }
    } catch {
      /* try next strategy */
    }
  }
  // 2) meta price tag
  const meta =
    html.match(/<meta[^>]+(?:product:price:amount|og:price:amount)[^>]+content="([\d.]+)"/i) ||
    html.match(/<meta[^>]+content="([\d.]+)"[^>]+(?:product:price:amount|og:price:amount)/i);
  if (meta) {
    const n = parseFloat(meta[1]);
    if (n > 0) return n;
  }
  // 3) Magento data-price-amount attribute
  const dpa = html.match(/data-price-amount="([\d.]+)"/);
  if (dpa) {
    const n = parseFloat(dpa[1]);
    if (n > 0) return n;
  }
  // 4) raw "KD 123.450" / "123.450 KD"
  const kd = html.match(/KD\s*([\d,]+\.\d{1,3})|([\d,]+\.\d{3})\s*KD/i);
  if (kd) {
    const n = parseFloat((kd[1] ?? kd[2]).replace(/,/g, ""));
    if (n > 0) return n;
  }
  return null;
}

function extractAvailability(html: string): string {
  if (/OutOfStock|out[\s_-]*of[\s_-]*stock|غير\s*متوفر|نفد/i.test(html)) return "out_of_stock";
  if (/InStock|in[\s_-]*stock|متوفر|add\s*to\s*cart|أضف\s*إلى/i.test(html)) return "in_stock";
  return "unknown";
}

function extractTitle(html: string, slug: string): string {
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  const tt = html.match(/<title>([^<]+)<\/title>/i);
  return decodeEntities(og?.[1] || tt?.[1] || slug).replace(/\s*\|\s*Next.*$/i, "").trim();
}

export const nextAdapter: StoreAdapter = {
  key: "next",
  store_name: "Next Computer Store",
  async fetchListings(): Promise<NormalizedListing[]> {
    const urls = (
      await enumerateSitemap(SITEMAP, { filter: LAPTOP_SLUG, maxSubSitemaps: 4, maxUrls: 200 })
    ).filter((u) => /\.html$/i.test(u) && STORAGE_RE.test(u) && !ACCESSORY_RE.test(u));

    const out: NormalizedListing[] = [];
    for (const url of urls) {
      const slug = slugFrom(url);
      const brand = guessBrand(slug);
      const specs = normalizeSpecs({ title: slug, brand }); // specs from the URL slug
      if (!looksLikeLaptop(slug, specs.cpu_tier)) continue;

      const html = await fetchText(url, 25_000); // 403 outside Kuwait -> null -> skip
      if (!html) continue;
      const price = extractPrice(html);
      if (price === null || price <= 0) continue; // no price = not ingestable

      const title = extractTitle(html, slug);
      out.push({
        external_id: url,
        source_type: "next",
        store_name: "Next Computer Store",
        product_title: title,
        brand,
        model: title,
        price: Math.round(price * 1000) / 1000,
        currency: "KWD",
        availability: extractAvailability(html),
        url,
        image_url: html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ?? null,
        country: "Kuwait",
        city_or_area: null,
        rating: null,
        review_count: null,
        specs: normalizeSpecs({ title, brand, text: slug }), // re-normalize with the real title
      });
      await new Promise((r) => setTimeout(r, 500)); // polite delay
    }
    return out;
  },
};
