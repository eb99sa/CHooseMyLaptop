import type { BasicNeeds, LaptopListing, SpecRange, UserAnswer } from "@/lib/types";
import { USE_CASE_BASELINES } from "@/lib/constants";
import { USE_CASE_LABELS } from "@/lib/i18n";

// Versioned prompts. Bump PROMPT_VERSION when changing any prompt so outputs
// stay traceable. Keep prompts here (not inline) for inspectability.
export const PROMPT_VERSION = "2026-06-25.v1";

// ---------------------------------------------------------------------------
// 1) Follow-up question generation (after Page 1)
// ---------------------------------------------------------------------------
export const QUESTION_SYSTEM = `أنت محلل احتياجات خبير في اختيار اللابتوبات. مهمتك إنشاء أسئلة متابعة قصيرة وبسيطة جداً لمستخدم لا يفهم في مواصفات الأجهزة.

القواعد:
- اكتب كل شيء بالعربية الفصحى البسيطة، بدون مصطلحات تقنية معقدة.
- اسأل فقط أسئلة مفيدة تكشف الاستخدام الحقيقي وتؤثر فعلاً على التوصية.
- لا تكرر معلومات معروفة مسبقاً من الإجابات الأساسية.
- اجعل الأسئلة قليلة: من 3 إلى 6 أسئلة كحد أقصى.
- فضّل الأسئلة ذات الخيارات (single_select / multi_select / boolean) لتسهيل الإجابة.
- لكل سؤال اذكر سبباً مختصراً (reason) يوضح لماذا نسأله.

أعد النتيجة بصيغة JSON فقط بهذا الشكل:
{
  "questions": [
    {
      "question_key": "snake_case_key",
      "question_text": "نص السؤال بالعربية",
      "question_type": "single_select | multi_select | boolean | text | number",
      "options": [ { "value": "code", "label": "النص بالعربية" } ],
      "reason": "سبب مختصر بالعربية",
      "sort_order": 1
    }
  ]
}
- للأنواع boolean / text / number اترك options فارغة أو احذفها.`;

export function buildQuestionUserPrompt(basic: BasicNeeds): string {
  const useCaseAr = USE_CASE_LABELS[basic.primary_use_case] ?? basic.primary_use_case;
  const locationAr =
    basic.location_source === "skipped" || (!basic.country && !basic.city_or_area)
      ? "(لم يحدّد المستخدم موقعه)"
      : [basic.city_or_area, basic.country].filter(Boolean).join("، ");
  return `معلومات المستخدم الأساسية:
- الاستخدام الرئيسي: ${useCaseAr}
- الميزانية: ${basic.budget_min}–${basic.budget_max} ${basic.currency}
- المنطقة/الدولة: ${locationAr}
- أهمية خفة الوزن: ${basic.portability}
- أهمية البطارية: ${basic.battery_importance}
- حجم الشاشة المفضّل: ${basic.screen_size_pref}
- يحتاج كيبورد عربي: ${basic.needs_arabic_keyboard ? "نعم" : "لا"}
- جديد/مستعمل: ${basic.condition_pref}
- مدى الاستعجال: ${basic.urgency}

أنشئ أسئلة المتابعة المناسبة لهذا الاستخدام تحديداً. مثال: إذا كان معلّماً اسأل عن البرامج التي يستخدمها (وورد/باوربوينت/منصات تعليمية)، وهل يحمل الجهاز يومياً، وهل يربطه بالبروجكتر. إذا كان طالباً اسأل عن الجامعة والتخصص والبرامج المتوقعة. اجعلها مناسبة لمستواه غير التقني.`;
}

// ---------------------------------------------------------------------------
// 2) Spec recommendation (after Page 2)
// ---------------------------------------------------------------------------
export const SPEC_SYSTEM = `أنت فريق خبراء مكوّن من: (1) محلل احتياجات، (2) أخصائي عتاد، (3) مُقيّم القيمة مقابل السعر (ROI)، (4) مراجع معارض يبحث عن المبالغة. مهمتكم تحويل احتياج المستخدم إلى مواصفات مناسبة — لا أقل من حاجته ولا أكثر.

المبادئ:
- اشرح بالعربية البسيطة، وميّز بوضوح بين الحقيقة والتقدير.
- لا توصِ بمواصفات أعلى من حاجة المستخدم الحقيقية (تجنّب الهدر).
- فضّل القيمة على المدى الطويل والاستخدام الواقعي على المواصفات البرّاقة.
- إذا توفّر موقع المستخدم (المنطقة/الدولة) فراعِ العملة المحلية والأسعار والتوفر والضمان المحلي. إذا لم يتوفّر الموقع فقدّم المواصفات ونطاق سعر عادل ونصائح عامة فقط.
- لا تدّعِ معرفة التوفر المحلي أو أسماء متاجر بعينها إن لم تتوفّر لديك بيانات؛ وضّح أن اقتراح المتاجر القريبة يتطلب تحديد الموقع.
- حدّد نطاق سعر عادل، وما هو السعر المنخفض المريب والسعر المبالغ فيه.
- cpu_tier من 1 إلى 10 (1 ضعيف جداً، 10 الأقوى). gpu أحد: integrated / entry_dedicated / mid_dedicated / high_dedicated.

أعد JSON فقط بهذا الشكل:
{
  "need_summary": "ملخص احتياج المستخدم بالعربية",
  "spec_range": {
    "minimum": { "cpu_class": "", "cpu_tier": 0, "ram_gb": 0, "storage_gb": 0, "storage_type": "SSD", "gpu": "integrated", "display_inch_min": 0, "display_inch_max": 0, "display_quality": "", "battery_hours_min": 0, "weight_kg_max": 0, "os": "Windows 11", "ports": [] },
    "ideal": { "cpu_class": "", "cpu_tier": 0, "ram_gb": 0, "storage_gb": 0, "storage_type": "SSD", "gpu": "integrated", "display_inch_min": 0, "display_inch_max": 0, "display_quality": "", "battery_hours_min": 0, "weight_kg_max": 0, "os": "Windows 11", "ports": [] },
    "unnecessary": ["مواصفة لا يحتاجها المستخدم بالعربية"]
  },
  "price_range": { "currency": "KWD", "too_low": 0, "fair_min": 0, "fair_max": 0, "overpriced": 0, "explanation": "شرح بالعربية" },
  "confidence": "high | medium | low",
  "notes": "ملاحظات اختيارية بالعربية"
}`;

export function buildSpecUserPrompt(basic: BasicNeeds, answers: UserAnswer[]): string {
  const useCaseAr = USE_CASE_LABELS[basic.primary_use_case] ?? basic.primary_use_case;
  const baseline = USE_CASE_BASELINES[basic.primary_use_case];
  const answersText = answers.length
    ? answers
        .map((a) => `- ${a.question_text}: ${a.answer_value}`)
        .join("\n")
    : "(لا توجد إجابات متابعة)";

  const locationAr =
    basic.location_source === "skipped" || (!basic.country && !basic.city_or_area)
      ? "(لم يحدّد المستخدم موقعه — لا تقترح متاجر قريبة)"
      : [basic.city_or_area, basic.country].filter(Boolean).join("، ");
  return `الاستخدام الرئيسي: ${useCaseAr}
الميزانية: ${basic.budget_min}–${basic.budget_max} ${basic.currency}
المنطقة/الدولة: ${locationAr}
أهمية خفة الوزن: ${basic.portability} — أهمية البطارية: ${basic.battery_importance}
حجم الشاشة المفضّل: ${basic.screen_size_pref} — كيبورد عربي: ${basic.needs_arabic_keyboard ? "نعم" : "لا"}
الحالة: ${basic.condition_pref}

إجابات المتابعة:
${answersText}

للاسترشاد فقط، هذه مواصفات مرجعية معتادة لهذا الاستخدام (لا تلتزم بها حرفياً، عدّلها حسب الإجابات والميزانية):
- الحد الأدنى المرجعي: ${baseline.minimum.cpu_class}، رام ${baseline.minimum.ram_gb}GB، تخزين ${baseline.minimum.storage_gb}GB ${baseline.minimum.storage_type}.
- المثالي المرجعي: ${baseline.ideal.cpu_class}، رام ${baseline.ideal.ram_gb}GB، تخزين ${baseline.ideal.storage_gb}GB ${baseline.ideal.storage_type}.

أعطِ المواصفات المناسبة ضمن الميزانية، مع نطاق سعر عادل بعملة ${basic.currency}.`;
}

// ---------------------------------------------------------------------------
// 3) Final narrative (after deterministic scoring)
// ---------------------------------------------------------------------------
export const NARRATIVE_SYSTEM = `أنت مستشار شراء لابتوبات تكتب الخلاصة النهائية للمستخدم بالعربية البسيطة الواضحة.

القواعد:
- اكتب فقرة قصيرة (3–6 جمل) تشرح التوصية النهائية بثقة وبدون مصطلحات معقدة.
- وضّح لماذا "الأفضل عموماً" يناسبه، ومتى يختار "الأفضل ضمن الميزانية" أو "أفضل قيمة".
- نبّه بلطف على الجهاز الذي يُفضّل تجنّبه وسببه إن وُجد.
- إذا كانت البيانات تقديرية اذكر أن على المستخدم تأكيد السعر والتوفر قبل الشراء.
أعد JSON فقط: { "narrative": "النص بالعربية" }`;

export function buildNarrativeUserPrompt(
  basic: BasicNeeds,
  spec: { need_summary: string; spec_range: SpecRange },
  picks: {
    best_overall?: { listing: LaptopListing; final_score: number; reasons: string[] };
    best_budget?: { listing: LaptopListing; final_score: number };
    best_value?: { listing: LaptopListing; final_score: number };
    avoid?: { listing: LaptopListing; warnings: string[] };
  },
): string {
  const line = (label: string, p?: { listing: LaptopListing; final_score?: number }) =>
    p
      ? `- ${label}: ${p.listing.product_title} بسعر ${p.listing.price} ${p.listing.currency}${
          p.final_score != null ? ` (تقييم ${Math.round(p.final_score)}/100)` : ""
        }`
      : `- ${label}: (لا يوجد)`;

  return `ملخص الاحتياج: ${spec.need_summary}
الميزانية: ${basic.budget_min}–${basic.budget_max} ${basic.currency}

الترشيحات بعد التحليل والتقييم:
${line("الأفضل عموماً", picks.best_overall)}
${line("الأفضل ضمن الميزانية", picks.best_budget)}
${line("أفضل قيمة على المدى الطويل", picks.best_value)}
${picks.avoid ? `- يُفضّل تجنّبه: ${picks.avoid.listing.product_title} — ${picks.avoid.warnings[0] ?? ""}` : "- لا يوجد جهاز يستحق التحذير منه"}

اكتب الخلاصة النهائية.`;
}
