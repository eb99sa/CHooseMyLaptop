// Re-derive CPU/GPU from existing listing titles IN PLACE (preserving listing IDs, so it does
// NOT orphan rtings review links the way a re-scrape would). Use after improving the chip
// detectors in lib/scrape/specs.ts. Only UPGRADES unknown/weaker values — never regresses.
//
//   npx tsx scripts/reprocess-specs.mts

import { readFileSync } from "node:fs";
function loadEnv(p: string) { try { for (const l of readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m || process.env[m[1]] != null) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } } catch {} }
loadEnv(".env.local");

import { cpuTier, gpuTier } from "@/lib/scrape/specs";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";

if (!isDbConfigured()) { console.error("[reprocess] Supabase not configured."); process.exit(1); }
const supabase = createServiceClient();

// Page through the whole catalog — Supabase caps a plain select at 1000 rows.
const rows: Array<{ id: string; product_title: string; specs_json: unknown }> = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("laptop_listings")
    .select("id, product_title, specs_json")
    .range(from, from + 999);
  if (error) { console.error("[reprocess]", error.message); process.exit(1); }
  if (!data || data.length === 0) break;
  rows.push(...(data as typeof rows));
  if (data.length < 1000) break;
}
console.log(`[reprocess] scanning ${rows.length} listings`);

let fixed = 0;
for (const row of rows) {
  const specs = (typeof row.specs_json === "string" ? JSON.parse(row.specs_json) : row.specs_json) as Record<string, unknown>;
  if (!specs || typeof specs !== "object") continue;
  const curCpuTier = Number(specs.cpu_tier ?? 0);
  const curGpuTier = Number(specs.gpu_tier ?? 0);
  let changed = false;

  // CPU: re-parse only when currently unknown (tier 0) and the title now yields a chip.
  if (curCpuTier === 0) {
    const nc = cpuTier(row.product_title);
    if (nc.cpu_tier > 0) { specs.cpu = nc.cpu; specs.cpu_tier = nc.cpu_tier; changed = true; }
  }
  // GPU: only upgrade (the title might lack a GPU that was parsed from a description).
  const ng = gpuTier(row.product_title);
  if (ng.gpu_tier > curGpuTier) { specs.gpu = ng.gpu; specs.gpu_tier = ng.gpu_tier; changed = true; }

  if (changed) {
    const { error: upErr } = await supabase.from("laptop_listings").update({ specs_json: specs }).eq("id", row.id);
    if (upErr) { console.error(`  ✗ ${row.id}: ${upErr.message}`); continue; }
    fixed += 1;
    if (fixed <= 25) console.log(`  ✓ ${String(row.product_title).slice(0, 46)} → ${specs.cpu} (t${specs.cpu_tier}) / ${specs.gpu}`);
  }
}
console.log(`\n[reprocess] updated ${fixed} listing(s) in place (IDs preserved).`);
