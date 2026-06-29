// Scraping subsystem (Phase 2 data) — shared contracts. OFFLINE only: these are
// run by scripts/scrape-stores.mts, never on the request path. Each store adapter
// fetches raw data and normalizes it into a NormalizedListing, which the upsert
// layer writes into laptop_listings.

import type { LaptopSpecs } from "@/lib/types";

/** A store listing normalized to the shape laptop_listings expects. */
export interface NormalizedListing {
  /** Stable id within the source (sku / product id / handle) — for idempotent upsert. */
  external_id: string;
  source_type: string; // adapter key, e.g. "pckuwait" | "wibi"
  store_name: string;
  product_title: string;
  brand: string;
  model: string;
  price: number; // KWD
  currency: string; // "KWD"
  availability: string; // "in_stock" | "out_of_stock" | "preorder" | "unknown"
  url: string | null;
  image_url: string | null;
  country: string; // "Kuwait"
  city_or_area: string | null;
  rating: number | null;
  review_count: number | null;
  specs: LaptopSpecs;
}

/** A per-store adapter: fetch raw catalog + return normalized laptop listings. */
export interface StoreAdapter {
  key: string; // "pckuwait"
  store_name: string; // "PCKuwait"
  /** Fetch + normalize the store's laptops. Must not throw — return [] on failure. */
  fetchListings(): Promise<NormalizedListing[]>;
}
