// Deterministic verification for the RAG wiring (no network / DB needed).
// Run from repo root:  npx tsx scripts/verify-rag.mts
// Confirms: chunker behaviour, graceful no-op when embeddings are unconfigured,
// query construction, and that grounding is additive (no grounding => identical
// spec prompt).

// Force the unconfigured path so the no-op assertion is deterministic regardless
// of the ambient environment.
delete process.env.OPENAI_API_KEY;

import type { BasicNeeds, UserAnswer } from "@/lib/types";
import { chunkText } from "@/lib/ai/rag/chunk";
import { isEmbeddingsConfigured } from "@/lib/ai/embeddings";
import { buildRetrievalQuery, retrieveKnowledge } from "@/lib/ai/rag/retrieve";
import { buildSpecUserPrompt } from "@/lib/ai/prompts";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`[${cond ? "PASS" : "FAIL"}] ${name}${detail ? `  — ${detail}` : ""}`);
}

// ---- chunker ----------------------------------------------------------------
const short = "جملة واحدة قصيرة.";
check("short text -> single chunk", JSON.stringify(chunkText(short)) === JSON.stringify([short]));

const longText = Array.from({ length: 20 }, () => "جملة قصيرة هنا.").join(" ");
const parts = chunkText(longText, { maxChars: 50 });
check("long text -> multiple chunks", parts.length > 1, `chunks=${parts.length}`);
check("every chunk within maxChars", parts.every((c) => c.length <= 50),
  `max=${Math.max(...parts.map((c) => c.length))}`);
const reassembledCount = parts.join(" ").split("جملة").length - 1;
check("no content dropped while chunking", reassembledCount === 20, `kept=${reassembledCount}`);

// ---- graceful no-op when embeddings unconfigured ----------------------------
check("isEmbeddingsConfigured() is false here", isEmbeddingsConfigured() === false);
const noopSupabase = { rpc: () => { throw new Error("must not be called"); } } as unknown;
const chunks = await retrieveKnowledge(noopSupabase as never, "استعلام تجريبي");
check("retrieveKnowledge returns [] (and never touches supabase) when unconfigured",
  Array.isArray(chunks) && chunks.length === 0);

// ---- query construction -----------------------------------------------------
const basic: BasicNeeds = {
  budget_min: 150, budget_max: 250, currency: "KWD", country: "Kuwait", city_or_area: "الكويت",
  location_source: "manual_search", primary_use_case: "teaching", portability: "very_important",
  battery_importance: "very_important", screen_size_pref: "medium", needs_arabic_keyboard: true,
  condition_pref: "new", urgency: "soon",
};
const answers: UserAnswer[] = [
  { question_key: "daily_carry", question_text: "هل تحمل اللابتوب يومياً؟", answer_value: "نعم", answer_type: "boolean" },
];
const query = buildRetrievalQuery(basic, answers);
check("retrieval query mentions the use case", query.includes("التدريس"), query);
check("retrieval query includes a follow-up answer", query.includes("هل تحمل اللابتوب يومياً؟"));

// ---- grounding is additive (no grounding => unchanged prompt) ----------------
const promptNone = buildSpecUserPrompt(basic, answers);
check("no grounding == undefined grounding", promptNone === buildSpecUserPrompt(basic, answers, undefined));
check("no grounding == empty grounding", promptNone === buildSpecUserPrompt(basic, answers, ""));
check("no grounding == whitespace grounding", promptNone === buildSpecUserPrompt(basic, answers, "   "));
const promptWith = buildSpecUserPrompt(basic, answers, "الرام 16 جيجا مريحة لتعدّد المهام.");
check("grounding is injected when present",
  promptWith.includes("الرام 16 جيجا مريحة") && promptWith.includes("قاعدة معرفة الشراء"));
check("grounding adds content (prompt grows)", promptWith.length > promptNone.length);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
