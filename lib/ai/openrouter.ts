import { extractJson } from "@/lib/utils";

// Thin OpenRouter chat client. Server-only.
// Returns parsed JSON of type T, or throws OpenRouterUnavailable so callers
// can fall back to the deterministic engine.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterUnavailable";
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

interface ChatOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

async function chat({ system, user, temperature = 0.4, maxTokens = 2000 }: ChatOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterUnavailable("OPENROUTER_API_KEY is not set");
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "CHooseMyLaptop",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      // Keep each call well under the 60s route budget; the recommend pipeline
      // makes up to two sequential calls (spec + narrative), so 25s x2 < 60s
      // leaves room for the graceful fallback to run instead of a hard timeout.
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    throw new OpenRouterUnavailable(`OpenRouter request failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OpenRouterUnavailable(`OpenRouter HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new OpenRouterUnavailable("OpenRouter returned no content");
  }
  return content;
}

/** Run a chat completion and parse a JSON object/array of type T. */
export async function chatJson<T>(options: ChatOptions): Promise<T> {
  const text = await chat(options);
  const parsed = extractJson<T>(text);
  if (parsed == null) {
    throw new OpenRouterUnavailable("Could not parse JSON from model response");
  }
  return parsed;
}
