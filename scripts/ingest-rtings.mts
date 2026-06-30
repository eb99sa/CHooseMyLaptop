// Ingest rtings' PUBLIC qualitative laptop findings into the RAG + laptop_reviews, attributed.
// Offline maintenance script (NOT the request path). Numeric rtings scores are paywalled and
// are never accessed — only the public qualitative test prose is used, cited to rtings.
//
//   npx tsx scripts/ingest-rtings.mts          # default cap
//   RTINGS_LIMIT=170 npx tsx scripts/ingest-rtings.mts   # full sitemap
//
// Requires .env.local: Supabase service role, OPENAI_API_KEY (embeddings), OpenRouter (distill).

import { readFileSync } from "node:fs";
function loadEnv(p: string) { try { for (const l of readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m || process.env[m[1]] != null) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; } } catch {} }
loadEnv(".env.local");

import type { LaptopListing } from "@/lib/types";
import { fetchRtingsReview, fetchRtingsReviewUrls, type RtingsReview } from "@/lib/scrape/sources/rtings";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { embedBatch, isEmbeddingsConfigured } from "@/lib/ai/embeddings";
import { chunkText } from "@/lib/ai/rag/chunk";
import { chatJson, isAiConfigured } from "@/lib/ai/openrouter";
import { fetchAllListings } from "@/lib/data/listings";

const LIMIT = Number(process.env.RTINGS_LIMIT) || 40;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (!isDbConfigured() || !isEmbeddingsConfigured() || !isAiConfigured()) {
  console.error("[rtings] needs Supabase + OPENAI_API_KEY + OpenRouter. Aborting.");
  process.exit(1);
}

/** Distill rtings' public findings into a concise, attributed Arabic snippet. No numbers invented. */
async function distill(r: RtingsReview): Promise<{ summary: string; pros: string[]; cons: string[] } | null> {
  const findingsText = r.findings.slice(0, 16).map((f) => `- ${f.name}: ${f.text}`).join("\n");
  try {
    const out = await chatJson<{ summary?: string; pros?: string[]; cons?: string[] }>({
      system:
        "أنت محرّر خبير. لخّص نتائج اختبار لابتوب (نوعية، من rtings) إلى عربية بسيطة وموجزة لمشترٍ غير تقني في الكويت. " +
        "لا تخترع أرقاماً أو تقييمات رقمية إطلاقاً (أرقام rtings غير متاحة). انسب الرأي لـ rtings.",
      user:
        `الجهاز: ${r.fullname}\nنتائج اختبار rtings النوعية:\n${findingsText}\n\n` +
        `أعد JSON فقط: {"summary":"جملتان تلخّصان رأي rtings عن الجهاز","pros":["نقطة","..."],"cons":["نقطة","..."]} — 3 إلى 5 نقاط لكل قائمة، عربية بسيطة.`,
      temperature: 0.3,
      maxTokens: 700,
    });
    if (!out?.summary?.trim()) return null;
    return { summary: out.summary.trim(), pros: (out.pros ?? []).slice(0, 5).map(String), cons: (out.cons ?? []).slice(0, 5).map(String) };
  } catch {
    return null;
  }
}

/** Fuzzy-match an rtings model family to catalog listings (brand + key tokens + chip), capped. */
function matchListings(r: RtingsReview, listings: LaptopListing[]): string[] {
  const tokens = r.model_family.split(" ").filter((t) => t.length >= 2).slice(0, 3);
  if (tokens.length === 0) return [];
  const brand = r.brand.toLowerCase();
  // Generation marker (Apple silicon chip) — so an M1 review doesn't link to M4 listings.
  const chip = (r.fullname.toLowerCase().match(/\bm[1-4]\s*(pro|max|ultra)?\b/) || [])[0]?.replace(/\s+/g, " ").trim();
  return listings
    .filter((l) => {
      const title = (l.product_title || "").toLowerCase();
      const lbrand = (l.brand || "").toLowerCase();
      if (brand && lbrand !== brand && !title.includes(brand)) return false;
      if (!tokens.every((t) => title.includes(t))) return false;
      if (chip && !title.includes(chip)) return false;
      return true;
    })
    .map((l) => l.id)
    .slice(0, 6); // cap review-links per model so one review can't blanket the catalog
}

const supabase = createServiceClient();
const listings = await fetchAllListings(supabase, {});
const urls = (await fetchRtingsReviewUrls()).slice(0, LIMIT);
console.log(`[rtings] reviews: ${urls.length} | catalog: ${listings.length}`);

let docs = 0;
let links = 0;
for (const url of urls) {
  const r = await fetchRtingsReview(url);
  await sleep(400); // be gentle with rtings
  if (!r || r.findings.length < 3) { console.log(`  · skip ${url} (no findings)`); continue; }
  const d = await distill(r);
  if (!d) { console.log(`  · skip ${r.fullname} (distill failed)`); continue; }

  const matches = matchListings(r, listings);
  const content =
    `حسب اختبارات rtings للجهاز «${r.fullname}»:\n${d.summary}\n` +
    `المميزات: ${d.pros.join("، ")}\nالعيوب: ${d.cons.join("، ")}\n(المصدر: rtings.com)`;
  const title = `rtings: ${r.fullname}`;

  // laptop_reviews: one row per matched listing (skip if unmatched — that table needs a listing).
  if (matches.length > 0) {
    await supabase.from("laptop_reviews").delete().eq("source_url", r.url);
    await supabase.from("laptop_reviews").insert(
      matches.map((lid) => ({
        laptop_listing_id: lid,
        source_name: "rtings",
        source_url: r.url,
        rating: null, // rtings numeric scores are paywalled — intentionally null
        review_summary: d.summary,
        pros_json: d.pros,
        cons_json: d.cons,
      })),
    );
    links += matches.length;
  }

  // RAG: knowledge_documents + embeddings (idempotent by title).
  await supabase.from("knowledge_documents").delete().eq("title", title);
  const { data: ins, error } = await supabase
    .from("knowledge_documents")
    .insert({ title, content, content_type: "review", metadata_json: { source: "rtings", url: r.url, brand: r.brand, model: r.model_family } })
    .select("id")
    .single();
  if (error || !ins) { console.log(`  · ${r.fullname} doc insert failed: ${error?.message}`); continue; }

  const parts = chunkText(content);
  const vectors = await embedBatch(parts);
  if (!vectors || vectors.length !== parts.length) { console.log(`  · ${r.fullname} embed failed`); continue; }
  await supabase.from("knowledge_embeddings").insert(
    parts.map((t, i) => ({ document_id: ins.id, embedding: vectors[i], chunk_text: t, metadata_json: { title, source: "rtings", url: r.url } })),
  );
  docs += 1;
  console.log(`  ✓ ${r.fullname} — ${matches.length} catalog match(es)`);
}

console.log(`\n[rtings] done: ${docs} rtings docs in RAG, ${links} catalog review-links.`);
