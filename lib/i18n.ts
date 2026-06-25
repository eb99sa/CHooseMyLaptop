import type {
  ConditionPref,
  Importance,
  RecommendationType,
  ScreenSizePref,
  UseCase,
  Urgency,
} from "@/lib/types";

// Arabic-first UI text. Code, keys, and comments stay in English by design.
// Centralized so the page layer and the AI prompts share the same vocabulary.

export const APP_NAME = "اختر لابتوبي";
export const APP_NAME_EN = "CHooseMyLaptop";
export const APP_TAGLINE = "نساعدك تختار أفضل لابتوب يناسب احتياجك وميزانيتك — بأعلى قيمة مقابل سعرك.";

export const USE_CASE_LABELS: Record<UseCase, string> = {
  teaching: "التدريس والتعليم",
  university: "الدراسة الجامعية",
  office: "أعمال مكتبية",
  programming: "البرمجة",
  design: "التصميم",
  engineering: "الهندسة",
  gaming: "الألعاب",
  video_editing: "مونتاج الفيديو",
  business: "إدارة الأعمال",
  family: "استخدام عائلي عام",
};

export const USE_CASE_DESCRIPTIONS: Record<UseCase, string> = {
  teaching: "عروض تقديمية، وورد، PDF، منصات تعليمية، ربط بالبروجكتر",
  university: "محاضرات، أبحاث، وقد تحتاج برامج حسب التخصص",
  office: "إكسل، وورد، إيميل، تصفّح، اجتماعات",
  programming: "برمجة، محررات أكواد، أدوات تطوير، أحياناً أجهزة افتراضية",
  design: "فوتوشوب، إليستريتور، فيغما، أعمال جرافيك",
  engineering: "أوتوكاد، ماتلاب، سوليدوركس، محاكاة",
  gaming: "ألعاب حديثة بأداء وإطارات عالية",
  video_editing: "تحرير فيديو، بريمير، دافنشي، تصدير سريع",
  business: "تنقّل دائم، اجتماعات، بطارية طويلة، خفة وزن",
  family: "تصفّح، يوتيوب، مهام بسيطة لكل العائلة",
};

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  very_important: "مهم جداً",
  somewhat: "مهم نوعاً ما",
  not_important: "غير مهم",
};

export const SCREEN_SIZE_LABELS: Record<ScreenSizePref, string> = {
  small: "صغيرة (13-14 بوصة)",
  medium: "متوسطة (15-15.6 بوصة)",
  large: "كبيرة (16-17 بوصة)",
  no_pref: "لا يهمني",
};

export const CONDITION_LABELS: Record<ConditionPref, string> = {
  new: "جديد فقط",
  used: "مستعمل مقبول",
  either: "جديد أو مستعمل",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  now: "أحتاجه الآن",
  soon: "خلال أسابيع قليلة",
  can_wait: "أستطيع الانتظار",
};

export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  best_overall: "الخيار الأفضل عموماً",
  best_budget: "الأفضل ضمن الميزانية",
  best_value: "أفضل قيمة على المدى الطويل",
  avoid: "يُفضّل تجنّبه",
};

export const SCORE_DIMENSION_LABELS = {
  use_case_fit: "ملاءمة الاستخدام",
  price_performance: "السعر مقابل الأداء",
  build_reliability: "جودة التصنيع والموثوقية",
  battery_portability: "البطارية وسهولة الحمل",
  display_comfort: "راحة الشاشة",
  upgradeability: "قابلية الترقية",
  local_availability: "التوفر محلياً والضمان",
} as const;

export const UI = {
  // shared
  loading: "جارٍ التحميل...",
  next: "التالي",
  back: "السابق",
  submit: "إرسال",
  start: "ابدأ الآن",
  continue: "متابعة",
  // landing
  heroTitle: "اختر اللابتوب المناسب لك بثقة",
  heroSubtitle:
    "ما تحتاج تفهم في المعالجات والكروت والمواصفات. جاوب على أسئلة بسيطة، وخل الذكاء الاصطناعي يرشّح لك أفضل جهاز بأعلى قيمة مقابل سعرك.",
  howItWorks: "كيف تعمل المنصة؟",
  step1Title: "١) جاوب أسئلة بسيطة",
  step1Body: "نسألك عن استخدامك وميزانيتك بلغة واضحة، بدون مصطلحات معقدة.",
  step2Title: "٢) الذكاء الاصطناعي يحلّل",
  step2Body: "نحوّل احتياجك إلى مواصفات مناسبة، لا أقل ولا أكثر من حاجتك.",
  step3Title: "٣) توصية واضحة",
  step3Body: "قائمة مرتّبة بأفضل الأجهزة، مع سبب كل ترشيح ونطاق السعر العادل.",
  ctaStart: "ابدأ توصيتك المجانية",
  // auth
  loginTitle: "تسجيل الدخول",
  loginSubtitle: "أدخل بريدك الإلكتروني وسنرسل لك رابط دخول سحري.",
  emailLabel: "البريد الإلكتروني",
  sendMagicLink: "أرسل رابط الدخول",
  magicLinkSent: "تم الإرسال! تفقّد بريدك واضغط على الرابط لتسجيل الدخول.",
  authError: "انتهت صلاحية الرابط أو تم استخدامه. حاول تسجيل الدخول من جديد.",
  signOut: "تسجيل الخروج",
  // dashboard
  dashboardTitle: "لوحتي",
  newSession: "توصية جديدة",
  mySessions: "توصياتي السابقة",
  noSessions: "لا توجد توصيات بعد. ابدأ توصيتك الأولى.",
  // form
  basicNeedsTitle: "احتياجاتك الأساسية",
  basicNeedsSubtitle: "خطوة ١ من ٢ — معلومات سريعة عنك وعن استخدامك.",
  followUpTitle: "أسئلة متابعة",
  followUpSubtitle: "خطوة ٢ من ٢ — أسئلة قصيرة لفهم استخدامك بدقة أكبر.",
  generatingQuestions: "نجهّز لك أسئلة مناسبة لحالتك...",
  buildingReport: "نحلّل احتياجك ونرتّب الأجهزة المناسبة...",
  // report
  reportTitle: "تقرير التوصية",
  needSummary: "ملخّص احتياجك",
  recommendedSpecs: "المواصفات المناسبة لك",
  minimumSpecs: "الحد الأدنى المقبول",
  idealSpecs: "المواصفات المثالية",
  unnecessarySpecs: "مواصفات لا تحتاجها (توفّر عليك المال)",
  priceRange: "نطاق السعر العادل",
  options: "الأجهزة المرشّحة",
  finalRecommendation: "الخلاصة والتوصية النهائية",
  whyThis: "لماذا هذا الجهاز؟",
  pros: "المميزات",
  cons: "العيوب",
  warnings: "تنبيهات",
  fitScore: "الملاءمة",
  roiScore: "القيمة (ROI)",
  finalScore: "التقييم الكلي",
  estimatedBadge: "بيانات تقديرية",
  estimatedNote:
    "بعض البيانات تقديرية وليست أسعاراً مباشرة من المتاجر. تأكّد من السعر والتوفر قبل الشراء.",
  compare: "قارن الأجهزة",
  // admin
  adminTitle: "لوحة الإدارة",
  exportCsv: "تصدير CSV",
} as const;

export const USE_CASE_ORDER: UseCase[] = [
  "teaching",
  "university",
  "office",
  "business",
  "programming",
  "design",
  "engineering",
  "video_editing",
  "gaming",
  "family",
];
