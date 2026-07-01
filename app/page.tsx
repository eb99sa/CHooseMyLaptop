import Link from "next/link";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { APP_NAME, UI, USE_CASE_LABELS, USE_CASE_ORDER } from "@/lib/i18n";
// The realistic laptop lives in the global background (BackgroundLaptop.tsx,
// mounted in the root layout), so the hero shows it too.

// Thin-line SVG step icons (no emoji — keeps the machined register).
function IconAnswer() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
      <path d="M8 9h9M8 13h6" />
    </svg>
  );
}
function IconAnalyze() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 1v3M14 1v3M10 20v3M14 20v3M1 10h3M1 14h3M20 10h3M20 14h3" />
    </svg>
  );
}
function IconTarget() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

const STEPS = [
  { n: 1, Icon: IconAnswer, title: UI.step1Title, body: UI.step1Body },
  { n: 2, Icon: IconAnalyze, title: UI.step2Title, body: UI.step2Body },
  { n: 3, Icon: IconTarget, title: UI.step3Title, body: UI.step3Body },
];

// The product's real value props — static, achromatic (the ember is reserved
// for the CTA), each a plain icon + bold title + silver one-liner.
const VALUES: { icon: IconName; title: string; body: string }[] = [
  { icon: "sparkle", title: "توصية بالذكاء الاصطناعي", body: "نحلّل احتياجك ونرشّح لك الأنسب لميزانيتك." },
  { icon: "wallet", title: "أفضل قيمة لفلوسك", body: "نركّز على العائد، مو المواصفات البرّاقة." },
  { icon: "info", title: "بعربي واضح", body: "نترجم المواصفات لفايدة تفهمها بسهولة، بدون تعقيد." },
  { icon: "scales", title: "تقييم شفّاف", body: "كل ترشيح تشوف ليش يناسبك ووين ممكن ما يناسب." },
  { icon: "store", title: "أسعار الكويت", body: "نراعي المتاجر والعملة والتوفّر المحلي." },
  { icon: "warranty", title: "بدون حساب", body: "خصوصيتك محفوظة — بلا تسجيل ولا بيانات." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* ---- Hero: full-bleed dark scene; content floats inside ---- */}
      <section className="relative isolate flex min-h-[86vh] items-center overflow-hidden">
        {/* A faint scrim keeps the copy legible over the 3D laptop — functional,
            not decoration (near-invisible canvas-on-canvas). */}
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(78% 82% at 76% 45%, color-mix(in srgb, var(--color-canvas) 92%, transparent), transparent 78%)",
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
          <div className="max-w-2xl animate-fadeup">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--color-faint)]">
              {APP_NAME} • بدون حساب
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] text-[var(--color-ink)] [text-wrap:balance] sm:text-5xl lg:text-6xl">
              {UI.heroTitle}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-ink-soft)] [text-wrap:pretty]">
              {UI.heroSubtitle}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/sessions/new" className="btn btn-primary text-base">
                {UI.ctaStart}
              </Link>
              <a href="#how-it-works" className="btn btn-ghost text-base">
                {UI.howItWorks}
              </a>
            </div>
            <p className="mt-6 text-sm text-[var(--color-muted)]">{UI.noLoginNeeded}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[var(--color-canvas)]" />
      </section>

      <main className="mx-auto max-w-6xl px-4">
        {/* ---- How it works: a clean 3-step sequence ---- */}
        <section id="how-it-works" className="py-20 sm:py-28">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] sm:text-3xl">
            {UI.howItWorks}
          </h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink)]">
                  <step.Icon />
                </span>
                <h3 className="mt-5 text-lg font-bold text-[var(--color-ink)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- Why us: static value props (achromatic; ember stays on the CTA) ---- */}
        <section className="pb-20 sm:pb-28">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] sm:text-3xl">
            ليش تختار لابتوبي
          </h2>
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="flex flex-col gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]">
                  <Icon name={v.icon} size={20} />
                </span>
                <h3 className="text-lg font-bold text-[var(--color-ink)]">{v.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Use cases ---- */}
        <section className="pb-20 sm:pb-28">
          <p className="text-center text-sm font-bold text-[var(--color-muted)]">
            مناسب لمختلف الاستخدامات
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {USE_CASE_ORDER.map((useCase) => (
              <span
                key={useCase}
                className="chip border border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
              >
                {USE_CASE_LABELS[useCase]}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-[var(--color-surface-2)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-10 text-center sm:flex-row sm:justify-between sm:text-start">
          <p className="text-sm font-bold text-[var(--color-ink)]">{APP_NAME}</p>
          <p className="max-w-xl text-xs text-[var(--color-muted)]">{UI.privacyNote}</p>
        </div>
      </footer>
    </div>
  );
}
