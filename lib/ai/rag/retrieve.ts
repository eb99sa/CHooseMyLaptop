// RAG retrieval. Server-only. Embeds a query and finds the nearest knowledge
// chunks via the match_knowledge RPC. Like every AI dependency here it degrades
// gracefully: with no embeddings key, no corpus, or any error it returns [], so
// the recommendation pipeline behaves exactly as it does today (no RAG).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BasicNeeds, UserAnswer } from "@/lib/types";
import { USE_CASE_LABELS } from "@/lib/i18n";
import { embedText, isEmbeddingsConfigured } from "@/lib/ai/embeddings";

export interface KnowledgeChunk {
  chunk_text: string;
  similarity: number;
  document_id: string;
}

/** Build a natural-language retrieval query from the user's needs + answers. */
export function buildRetrievalQuery(basic: BasicNeeds, answers: UserAnswer[]): string {
  const useCaseAr = USE_CASE_LABELS[basic.primary_use_case] ?? basic.primary_use_case;
  const answerBits = answers
    .map((a) => `${a.question_text}: ${a.answer_value}`)
    .filter((s) => s.trim())
    .join(" ، ");
  return [
    `الاستخدام: ${useCaseAr}`,
    `الميزانية: ${basic.budget_min}–${basic.budget_max} ${basic.currency}`,
    answerBits,
  ]
    .filter(Boolean)
    .join(" — ");
}

/** Retrieve the top knowledge chunks for a query. Returns [] when unavailable. */
export async function retrieveKnowledge(
  supabase: SupabaseClient,
  query: string,
  matchCount = 6,
): Promise<KnowledgeChunk[]> {
  if (!isEmbeddingsConfigured()) return [];
  const q = (query || "").trim();
  if (!q) return [];

  const embedding = await embedText(q);
  if (!embedding) return [];

  try {
    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: embedding,
      match_count: matchCount,
    });
    if (error || !Array.isArray(data)) {
      if (error) console.warn("[rag] match_knowledge failed:", error.message);
      return [];
    }
    return (data as Array<{ chunk_text?: string; similarity?: number; document_id?: string }>)
      .filter((r) => r && typeof r.chunk_text === "string" && r.chunk_text.trim())
      .map((r) => ({
        chunk_text: (r.chunk_text as string).trim(),
        similarity: typeof r.similarity === "number" ? r.similarity : 0,
        document_id: r.document_id ?? "",
      }));
  } catch (err) {
    console.warn("[rag] retrieval error:", (err as Error).message);
    return [];
  }
}

/** Format retrieved chunks as a numbered grounding block, or "" when empty. */
export function formatGrounding(chunks: KnowledgeChunk[], maxChunks = 5): string {
  const top = chunks
    .slice(0, maxChunks)
    .map((c) => c.chunk_text.trim())
    .filter(Boolean);
  if (top.length === 0) return "";
  return top.map((t, i) => `(${i + 1}) ${t}`).join("\n");
}
