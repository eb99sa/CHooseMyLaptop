// Write normalized store listings into laptop_listings. Idempotent per source:
// a successful run REPLACES that source's rows with the store's current catalog
// (prices/availability change, so a full per-source refresh is the right model).
// Seed rows (source_type "seed") and other stores are never touched.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedListing } from "@/lib/scrape/types";
import { safeHttpUrl } from "@/lib/url";

export async function replaceSourceListings(
  supabase: SupabaseClient,
  sourceKey: string,
  listings: NormalizedListing[],
): Promise<number> {
  // Never wipe a source on an empty fetch (likely a transient failure).
  if (listings.length === 0) return 0;

  const rows = listings.map((l) => ({
    store_name: l.store_name,
    product_title: l.product_title,
    brand: l.brand,
    model: l.model,
    price: l.price,
    currency: l.currency,
    availability: l.availability,
    url: safeHttpUrl(l.url),
    image_url: safeHttpUrl(l.image_url),
    country: l.country,
    city_or_area: l.city_or_area,
    specs_json: l.specs,
    rating: l.rating,
    review_count: l.review_count,
    source_type: l.source_type,
    last_checked_at: new Date().toISOString(),
  }));

  const { error: delErr } = await supabase
    .from("laptop_listings")
    .delete()
    .eq("source_type", sourceKey);
  if (delErr) throw new Error(`delete failed for ${sourceKey}: ${delErr.message}`);

  const { error: insErr } = await supabase.from("laptop_listings").insert(rows);
  if (insErr) throw new Error(`insert failed for ${sourceKey}: ${insErr.message}`);

  return rows.length;
}
