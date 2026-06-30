import type { AIQuestion, AnswerType, BasicNeeds, UseCase } from "@/lib/types";
import { chatJson, isAiConfigured } from "@/lib/ai/openrouter";
import { QUESTION_SYSTEM, buildQuestionUserPrompt } from "@/lib/ai/prompts";

const VALID_TYPES: AnswerType[] = [
  "text",
  "number",
  "boolean",
  "single_select",
  "multi_select",
];

interface RawQuestion {
  question_key?: string;
  question_text?: string;
  question_type?: string;
  options?: Array<{ value?: string; label?: string }>;
  reason?: string;
  sort_order?: number;
}

function normalize(raw: RawQuestion[], fallbackUseCase: UseCase): AIQuestion[] {
  const seen = new Set<string>();
  const out: AIQuestion[] = [];
  raw.forEach((q, i) => {
    const text = (q.question_text || "").trim();
    if (!text) return;
    let key = (q.question_key || `q_${i + 1}`).trim().replace(/\s+/g, "_");
    if (seen.has(key)) key = `${key}_${i}`;
    seen.add(key);

    const type: AnswerType = VALID_TYPES.includes(q.question_type as AnswerType)
      ? (q.question_type as AnswerType)
      : "single_select";

    const options =
      (type === "single_select" || type === "multi_select") && Array.isArray(q.options)
        ? q.options
            .filter((o) => o && (o.label || o.value))
            .map((o, j) => ({
              value: String(o.value ?? o.label ?? j),
              label: String(o.label ?? o.value ?? ""),
            }))
        : undefined;

    // A select with no options is useless; downgrade to text.
    const finalType = (type === "single_select" || type === "multi_select") && (!options || options.length === 0)
      ? "text"
      : type;

    out.push({
      question_key: key,
      question_text: text,
      question_type: finalType,
      options: finalType === "single_select" || finalType === "multi_select" ? options : undefined,
      reason: q.reason?.trim() || undefined,
      sort_order: typeof q.sort_order === "number" ? q.sort_order : i + 1,
    });
  });

  out.sort((a, b) => a.sort_order - b.sort_order);
  return out.length > 0 ? out.slice(0, 6) : fallbackQuestions(fallbackUseCase);
}

export async function generateFollowUpQuestions(
  basic: BasicNeeds,
): Promise<{ questions: AIQuestion[]; source: "ai" | "fallback" }> {
  if (isAiConfigured()) {
    try {
      const data = await chatJson<{ questions?: RawQuestion[] }>({
        system: QUESTION_SYSTEM,
        user: buildQuestionUserPrompt(basic),
        temperature: 0.5,
        maxTokens: 1500,
      });
      const questions = normalize(data.questions ?? [], basic.primary_use_case);
      return { questions, source: "ai" };
    } catch (err) {
      console.warn("[ai] follow-up questions fell back to deterministic:", (err as Error).message);
      // fall through to deterministic questions
    }
  }
  return { questions: fallbackQuestions(basic.primary_use_case), source: "fallback" };
}

// ---------------------------------------------------------------------------
// Deterministic, hand-written follow-up questions per use case (no-API mode).
// ---------------------------------------------------------------------------
function q(
  question_key: string,
  question_text: string,
  question_type: AnswerType,
  sort_order: number,
  options?: Array<{ value: string; label: string }>,
  reason?: string,
): AIQuestion {
  return { question_key, question_text, question_type, options, reason, sort_order };
}

const COMMON: AIQuestion[] = [
  q(
    "daily_carry",
    "هل تحمل اللابتوب معك يومياً؟",
    "boolean",
    90,
    undefined,
    "يحدد أهمية خفة الوزن والبطارية.",
  ),
  q(
    "screen_connect",
    "هل تحتاج توصيل الجهاز بشاشة خارجية أو بروجكتر؟",
    "boolean",
    91,
    undefined,
    "يحدد المنافذ المطلوبة (HDMI/USB-C).",
  ),
];

const BY_USE_CASE: Partial<Record<UseCase, AIQuestion[]>> = {
  teaching: [
    q(
      "teaching_apps",
      "ما البرامج التي تستخدمها غالباً في عملك؟",
      "multi_select",
      1,
      [
        { value: "office", label: "وورد / باوربوينت / إكسل" },
        { value: "pdf", label: "ملفات PDF" },
        { value: "browser", label: "تصفّح ومنصات تعليمية" },
        { value: "smartboard", label: "برامج السبورة الذكية" },
        { value: "video", label: "مقاطع فيديو تعليمية" },
      ],
      "يحدد قوة المعالج والذاكرة المطلوبة.",
    ),
    q(
      "school_battery",
      "كم ساعة تحتاج البطارية أن تصمد خلال الدوام؟",
      "single_select",
      2,
      [
        { value: "4", label: "حتى ٤ ساعات" },
        { value: "7", label: "حوالي يوم دراسي (٧ ساعات)" },
        { value: "10", label: "يوم كامل بدون شاحن" },
      ],
      "يحدد أولوية البطارية في الترشيح.",
    ),
  ],
  university: [
    q(
      "uni_major",
      "ما الجامعة والتخصص الذي ستدرسه؟",
      "text",
      1,
      undefined,
      "نستنتج منه البرامج المتوقعة ومتطلبات الأداء.",
    ),
    q(
      "uni_software",
      "هل تتوقع استخدام برامج ثقيلة؟",
      "multi_select",
      2,
      [
        { value: "autocad", label: "أوتوكاد / سوليدوركس" },
        { value: "matlab", label: "ماتلاب / حسابات هندسية" },
        { value: "adobe", label: "برامج Adobe للتصميم" },
        { value: "vm", label: "أجهزة افتراضية / برمجة" },
        { value: "none", label: "أعمال خفيفة فقط" },
      ],
      "يحدد إن كنت تحتاج كرت شاشة وذاكرة أكبر.",
    ),
  ],
  programming: [
    q(
      "prog_stack",
      "ما نوع البرمجة التي ستعمل عليها؟",
      "multi_select",
      1,
      [
        { value: "web", label: "ويب / تطبيقات بسيطة" },
        { value: "mobile", label: "تطبيقات موبايل" },
        { value: "data_ai", label: "بيانات / ذكاء اصطناعي" },
        { value: "games", label: "تطوير ألعاب" },
        { value: "vm", label: "أجهزة افتراضية / حاويات Docker" },
      ],
      "يحدد حجم الذاكرة والحاجة لكرت شاشة.",
    ),
  ],
  gaming: [
    q(
      "games_list",
      "ما الألعاب التي تلعبها غالباً؟",
      "text",
      1,
      undefined,
      "يحدد قوة كرت الشاشة المطلوب.",
    ),
    q(
      "game_priority",
      "أيهما أهم لك؟",
      "single_select",
      2,
      [
        { value: "performance", label: "أعلى أداء وإطارات" },
        { value: "balance", label: "توازن بين الأداء والبطارية" },
        { value: "portable", label: "خفّة وبطارية أطول" },
      ],
      "يوازن بين الأداء والتنقّل.",
    ),
  ],
  design: [
    q(
      "design_tools",
      "ما برامج التصميم التي تستخدمها؟",
      "multi_select",
      1,
      [
        { value: "photoshop", label: "فوتوشوب / إليستريتور" },
        { value: "figma", label: "فيغما / واجهات" },
        { value: "3d", label: "أعمال ثلاثية الأبعاد" },
        { value: "video", label: "مونتاج فيديو" },
      ],
      "يحدد دقة الشاشة وقوة المعالج والكرت.",
    ),
  ],
  video_editing: [
    q(
      "video_res",
      "ما دقة الفيديو التي تحرّرها غالباً؟",
      "single_select",
      1,
      [
        { value: "1080", label: "Full HD (1080p)" },
        { value: "4k", label: "4K" },
        { value: "mixed", label: "متنوعة" },
      ],
      "تحدد قوة المعالج والكرت والذاكرة.",
    ),
  ],
  engineering: [
    q(
      "eng_software",
      "ما البرامج الهندسية المتوقعة؟",
      "multi_select",
      1,
      [
        { value: "autocad", label: "أوتوكاد" },
        { value: "solidworks", label: "سوليدوركس" },
        { value: "matlab", label: "ماتلاب" },
        { value: "simulation", label: "محاكاة ثقيلة" },
      ],
      "تحدد الحاجة لكرت شاشة احترافي وذاكرة أكبر.",
    ),
  ],
};

export function fallbackQuestions(useCase: UseCase): AIQuestion[] {
  const specific = BY_USE_CASE[useCase] ?? [];
  return [...specific, ...COMMON].sort((a, b) => a.sort_order - b.sort_order).slice(0, 6);
}
