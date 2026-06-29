// Deterministic text chunker for the knowledge corpus. Pure (no I/O), so it is
// unit-testable. Splits on paragraph/sentence boundaries and packs into chunks
// of at most ~maxChars, never splitting mid-sentence when avoidable.

export interface ChunkOptions {
  maxChars?: number; // soft cap per chunk
  minChars?: number; // merge trailing scraps smaller than this into the previous chunk
}

const DEFAULTS: Required<ChunkOptions> = { maxChars: 600, minChars: 80 };

// Split on blank lines first, then on sentence enders (Arabic + Latin), keeping
// the delimiter with its sentence.
function segments(text: string): string[] {
  const paras = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const para of paras) {
    // Arabic full stop (.), question (؟), Latin .?! — split but keep the mark.
    const sentences = para
      .split(/(?<=[.!؟?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(...(sentences.length ? sentences : [para]));
  }
  return out;
}

/** Split `text` into chunks of at most ~maxChars, on sentence boundaries. */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const { maxChars, minChars } = { ...DEFAULTS, ...opts };
  const clean = (text || "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const parts = segments(clean);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if (!current) {
      current = part;
    } else if (current.length + 1 + part.length <= maxChars) {
      current = `${current} ${part}`;
    } else {
      chunks.push(current);
      current = part;
    }
  }
  if (current) chunks.push(current);

  // Merge a tiny trailing chunk back into its predecessor — but only when the
  // result still fits maxChars (honour the cap over the min-size preference).
  if (chunks.length > 1 && chunks[chunks.length - 1].length < minChars) {
    const tail = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (prev.length + 1 + tail.length <= maxChars) {
      chunks.pop();
      chunks[chunks.length - 1] = `${prev} ${tail}`;
    }
  }
  return chunks;
}
