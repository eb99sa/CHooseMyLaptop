// Offline store-catalog sync. Fetches the clean-JSON KW stores, normalizes to
// LaptopSpecs, and (unless --dry-run) replaces each source's rows in
// laptop_listings. NOT part of the request path. Run from repo root:
//
//   npx tsx scripts/scrape-stores.mts --dry-run            # fetch + parse, no DB write
//   npx tsx scripts/scrape-stores.mts                      # write all sources
//   npx tsx scripts/scrape-stores.mts --source=pckuwait    # one source
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
// (only for the real write; --dry-run needs no DB).

import { readFileSync } from "node:fs";
function loadEnv(path: string) {
  try {
    for (const l of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || process.env[m[1]] != null) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv(".env.local");

import type { StoreAdapter } from "@/lib/scrape/types";
import { pckuwaitAdapter } from "@/lib/scrape/sources/pckuwait";
import { wibiAdapter } from "@/lib/scrape/sources/wibi";
import { replaceSourceListings } from "@/lib/scrape/upsert";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";

const ADAPTERS: StoreAdapter[] = [pckuwaitAdapter, wibiAdapter];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyArg = args.find((a) => a.startsWith("--source="));
const only = onlyArg ? onlyArg.split("=")[1].split(",") : null;
const selected = ADAPTERS.filter((a) => !only || only.includes(a.key));

if (!dryRun && !isDbConfigured()) {
  console.error("[scrape] DB not configured — set Supabase env, or pass --dry-run.");
  process.exit(1);
}
const supabase = dryRun ? null : createServiceClient();

let total = 0;
for (const adapter of selected) {
  const t0 = Date.now();
  const listings = await adapter.fetchListings();
  console.log(`\n[${adapter.key}] fetched ${listings.length} laptop(s) in ${Date.now() - t0}ms`);
  for (const l of listings.slice(0, 5)) {
    const s = l.specs;
    console.log(
      `   • ${l.product_title.slice(0, 58)}\n     ${l.price} ${l.currency} | ${l.availability} | cpu_tier=${s.cpu_tier}(${s.cpu}) ram=${s.ram_gb} gpu_tier=${s.gpu_tier}(${s.gpu}) ${s.storage_gb}${s.storage_type} ${s.display_inch}" ${s.display_panel}`,
    );
  }
  if (!dryRun && supabase) {
    const n = await replaceSourceListings(supabase, adapter.key, listings);
    console.log(`[${adapter.key}] wrote ${n} rows to laptop_listings (replaced source '${adapter.key}')`);
    total += n;
  }
}

console.log(`\n${dryRun ? "[dry-run] no DB writes." : `[scrape] done: ${total} rows written.`}`);
