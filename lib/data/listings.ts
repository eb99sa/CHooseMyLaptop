import type { SupabaseClient } from "@supabase/supabase-js";
import type { LaptopListing, LaptopSpecs } from "@/lib/types";
import { safeJsonParse } from "@/lib/utils";

// Safe defaults so a malformed specs_json can never crash scoring.
const DEFAULT_SPECS: LaptopSpecs = {
  cpu: "غير معروف",
  cpu_tier: 4,
  ram_gb: 8,
  storage_gb: 256,
  storage_type: "SSD",
  gpu: "Integrated",
  gpu_tier: 1,
  display_inch: 15.6,
  display_resolution: "1920x1080",
  display_panel: "IPS",
  battery_hours: 6,
  weight_kg: 1.8,
  os: "Windows 11",
  release_year: 2022,
};

interface ListingRow {
  id: string;
  store_name: string | null;
  product_title: string;
  brand: string | null;
  model: string | null;
  price: number | string;
  currency: string;
  availability: string | null;
  url: string | null;
  country: string | null;
  city_or_area: string | null;
  specs_json: unknown;
  rating: number | string | null;
  review_count: number | null;
  source_type: string | null;
  last_checked_at: string | null;
}

export function mapListingRow(row: ListingRow): LaptopListing {
  const specs = { ...DEFAULT_SPECS, ...safeJsonParse<Partial<LaptopSpecs>>(row.specs_json, {}) };
  return {
    id: row.id,
    store_name: row.store_name ?? "",
    product_title: row.product_title,
    brand: row.brand ?? "",
    model: row.model ?? "",
    price: Number(row.price),
    currency: row.currency ?? "KWD",
    availability: row.availability ?? "unknown",
    url: row.url,
    country: row.country,
    city_or_area: row.city_or_area,
    specs,
    rating: row.rating != null ? Number(row.rating) : null,
    review_count: row.review_count ?? null,
    source_type: row.source_type ?? "seed",
    last_checked_at: row.last_checked_at,
  };
}

interface FetchOpts {
  /** Prefer listings in this country if any exist; otherwise return all. */
  country?: string | null;
}

/** Fetch the catalog (cheapest first), optionally preferring a country. */
export async function fetchAllListings(
  supabase: SupabaseClient,
  opts: FetchOpts = {},
): Promise<LaptopListing[]> {
  const { data, error } = await supabase
    .from("laptop_listings")
    .select("*")
    .order("price", { ascending: true });
  if (error) throw new Error(`Failed to load listings: ${error.message}`);

  const all = (data ?? []).map((r) => mapListingRow(r as ListingRow));

  const country = opts.country?.trim().toLowerCase();
  if (country) {
    const local = all.filter((l) => (l.country ?? "").trim().toLowerCase() === country);
    // Only narrow to the country when we actually have local stock; otherwise
    // fall back to the full catalog (the report labels results as estimated).
    if (local.length > 0) return local;
  }
  return all;
}
