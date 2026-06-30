// Next Computer Store (nextstore.com.kw) adapter — Magento 2 behind Cloudflare.
// Product pages serve a "Just a moment…" anti-bot challenge that plain fetch can't
// pass, so they're fetched with a real headless browser (lib/scrape/headless.ts).
// Best run from a Kuwaiti residential connection (Cloudflare waved the browser
// through with no challenge there). The spec-rich URL slug supplies the specs; the
// browser-rendered page supplies price + availability.

import type { NormalizedListing, StoreAdapter } from "@/lib/scrape/types";
import { ACCESSORY_RE, decodeEntities, guessBrand, looksLikeLaptop, normalizeSpecs } from "@/lib/scrape/specs";
import { enumerateSitemap } from "@/lib/scrape/sitemap";
import { fetchRendered } from "@/lib/scrape/headless";

const SITEMAP = "https://www.nextstore.com.kw/sitemap_index.xml";
// A laptop slug carries "<n>gb-ram" + a storage type — accessories/monitors don't.
const LAPTOP_SLUG = /\d+gb-ram/i;
const STORAGE_RE = /(ssd|hdd|emmc|nvme)/i;
// Per-run cap — browser fetches are ~3-5s each, so a full ~197-laptop run is slow.
// Override with SCRAPE_NEXT_LIMIT (e.g. SCRAPE_NEXT_LIMIT=20 for a quick run).
const NEXT_MAX_URLS = Number(process.env.SCRAPE_NEXT_LIMIT) || 200;

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
  // 1) Authoritative per-product signal: schema.org offers.availability in JSON-LD
  //    (same node extractPrice reads). The "add to cart" button is NOT reliable — it's
  //    rendered even for out-of-stock items — and loose "out of stock" text matches
  //    stray copy elsewhere on the page, so we don't use either.
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j: unknown = JSON.parse(m[1]);
      for (const node of (Array.isArray(j) ? j : [j]) as Array<{ offers?: unknown }>) {
        const offers = node.offers;
        const off = Array.isArray(offers) ? offers[0] : offers;
        const av = off && typeof off === "object" ? String((off as { availability?: unknown }).availability ?? "") : "";
        if (/InStock|LimitedAvailability|PreOrder|BackOrder|OnlineOnly/i.test(av)) return "in_stock";
        if (/OutOfStock|SoldOut|Discontinued/i.test(av)) return "out_of_stock";
      }
    } catch {
      /* try next strategy */
    }
  }
  // 2) Magento stock div: <div class="stock available"> / "stock unavailable".
  //    \bavailable\b does not match inside "unavailable", so order is safe.
  if (/\bstock\s+unavailable\b/i.test(html)) return "out_of_stock";
  if (/\bstock\s+available\b/i.test(html)) return "in_stock";
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
      await enumerateSitemap(SITEMAP, { filter: LAPTOP_SLUG, maxSubSitemaps: 4, maxUrls: NEXT_MAX_URLS })
    ).filter((u) => /\.html$/i.test(u) && STORAGE_RE.test(u) && !ACCESSORY_RE.test(u));

    const out: NormalizedListing[] = [];
    for (const url of urls) {
      const slug = slugFrom(url);
      const brand = guessBrand(slug);
      const specs = normalizeSpecs({ title: slug, brand }); // specs from the URL slug
      if (!looksLikeLaptop(slug, specs.cpu_tier)) continue;

      const html = await fetchRendered(url); // real browser clears Cloudflare's challenge
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
    }
    return out;
  },
};
