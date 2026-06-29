// Optional OpenAI embeddings client. Server-only.
//
// OpenRouter (used for chat) does not serve embeddings, so RAG uses OpenAI's
// text-embedding-3-small (1536 dims — matches the pgvector(1536) schema). Like
// every AI dependency in this app, embeddings are OPTIONAL: with no key (or on
// any failure) the functions return null and callers degrade to no-RAG.

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function embedModel(): string {
  return process.env.OPENAI_EMBED_MODEL || DEFAULT_MODEL;
}

async function callOpenAI(input: string | string[]): Promise<number[][] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(OPENAI_EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: embedModel(), input }),
      // Kept short on purpose: this call is on the recommendation request path,
      // which already budgets two sequential OpenRouter calls under a 60s route.
      // On slowness we'd rather degrade to no-RAG than eat the latency budget.
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.warn(`[embeddings] OpenAI HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };
    const rows = data.data;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    // Preserve request order (OpenAI returns an `index` per row).
    const ordered = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const vectors = ordered.map((r) => r.embedding);
    if (vectors.some((v) => !Array.isArray(v) || v.length !== EMBEDDING_DIM)) {
      console.warn("[embeddings] unexpected embedding shape");
      return null;
    }
    return vectors as number[][];
  } catch (err) {
    console.warn("[embeddings] request failed:", (err as Error).message);
    return null;
  }
}

/** Embed a single string. Returns a 1536-dim vector, or null if unavailable. */
export async function embedText(text: string): Promise<number[] | null> {
  const clean = text.trim();
  if (!clean) return null;
  const out = await callOpenAI(clean);
  return out?.[0] ?? null;
}

/**
 * Embed many strings in one request (used by the ingestion script). Returns one
 * vector per input in order, or null if the whole call failed.
 */
export async function embedBatch(texts: string[]): Promise<number[][] | null> {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  return callOpenAI(clean);
}
