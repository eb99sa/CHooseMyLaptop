// Ingest the curated knowledge corpus into Supabase for RAG (Phase 2).
// Offline maintenance script — NOT part of the request path. Run from repo root:
//
//   npx tsx scripts/ingest-knowledge.mts
//
// Requires (in .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// and OPENAI_API_KEY. Run supabase/schema.sql + supabase/rag.sql first. The
// script is idempotent: it replaces any document with the same title.

import { readFileSync } from "node:fs";
import { KNOWLEDGE_CORPUS } from "@/lib/ai/rag/corpus";
import { chunkText } from "@/lib/ai/rag/chunk";
import { embedBatch, isEmbeddingsConfigured } from "@/lib/ai/embeddings";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";

// Standalone scripts don't get Next.js's automatic .env.local loading.
function loadEnv(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || process.env[m[1]] != null) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}
loadEnv(".env.local");

async function main() {
  if (!isDbConfigured()) {
    console.error("[ingest] Supabase not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Aborting.");
    process.exit(1);
  }
  if (!isEmbeddingsConfigured()) {
    console.error("[ingest] OPENAI_API_KEY not set — embeddings unavailable. Aborting.");
    process.exit(1);
  }

  const supabase = createServiceClient();
  let docs = 0;
  let chunks = 0;

  for (const doc of KNOWLEDGE_CORPUS) {
    // Idempotent re-ingest: drop any prior version of this document (cascade
    // removes its embeddings), then insert fresh.
    await supabase.from("knowledge_documents").delete().eq("title", doc.title);

    const { data: inserted, error: docErr } = await supabase
      .from("knowledge_documents")
      .insert({
        title: doc.title,
        content: doc.content,
        content_type: doc.content_type,
        metadata_json: doc.metadata ?? {},
      })
      .select("id")
      .single();
    if (docErr || !inserted) {
      console.error(`[ingest] failed to insert "${doc.title}": ${docErr?.message}`);
      continue;
    }
    const documentId = inserted.id as string;

    const parts = chunkText(doc.content);
    const vectors = await embedBatch(parts);
    if (!vectors || vectors.length !== parts.length) {
      console.error(`[ingest] embedding failed for "${doc.title}" — skipping its chunks`);
      continue;
    }

    // NOTE: pgvector accepts a numeric array here (Supabase's documented form).
    // If your stack rejects it, JSON.stringify(vectors[i]) is the safe fallback.
    const rows = parts.map((text, i) => ({
      document_id: documentId,
      embedding: vectors[i],
      chunk_text: text,
      metadata_json: { title: doc.title, content_type: doc.content_type, ...doc.metadata },
    }));
    const { error: embErr } = await supabase.from("knowledge_embeddings").insert(rows);
    if (embErr) {
      console.error(`[ingest] failed to insert embeddings for "${doc.title}": ${embErr.message}`);
      continue;
    }
    docs += 1;
    chunks += rows.length;
    console.log(`[ingest] ${doc.title} — ${rows.length} chunk(s)`);
  }

  console.log(`\n[ingest] done: ${docs} document(s), ${chunks} chunk(s).`);
}

main().catch((err) => {
  console.error("[ingest] fatal:", (err as Error).message);
  process.exit(1);
});
