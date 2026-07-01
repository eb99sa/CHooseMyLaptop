import Link from "next/link";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { APP_NAME, UI, USE_CASE_LABELS, USE_CASE_ORDER } from "@/lib/i18n";
// The realistic laptop now lives in the global background (components/landing/
// BackgroundLaptop.tsx, mounted in the root layout), so the hero shows it too.

// Thin-line SVG step icons (no emoji — keeps the techno/minimalist register).
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
  { n: 1, Icon: IconAnswer, title: UI.step1Title, body: UI.step1Body, tilt: "rotateY(11deg)", lift: "translateY(14px)", delay: "0ms" },
  { n: 2, Icon: IconAnalyze, title: UI.step2Title, body: UI.step2Body, tilt: "rotateY(0deg)", lift: "translateY(-12px) scale(1.04)", delay: "120ms" },
  { n: 3, Icon: IconTarget, title: UI.step3Title, body: UI.step3Body, tilt: "rotateY(-11deg)", lift: "translateY(14px)", delay: "240ms" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* ---- Hero: full-bleed isometric space scene; content floats inside ---- */}
      <section className="relative isolate flex min-h-[88vh] items-center overflow-hidden">
        {/* mist veil behind the (RTL, start-aligned) copy — keeps carbon text
            high-contrast over the chrome object without darkening the canvas */}
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(78% 82% at 76% 45%, color-mix(in srgb, var(--color-canvas) 94%, transparent), color-mix(in srgb, var(--color-canvas) 60%, transparent) 52%, transparent 82%)",
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
          <div className="max-w-2xl animate-fadeup">
            <span className="font-mono text-[0.6875rem] font-medium text-[var(--color-muted)]">
              {APP_NAME} • بدون حساب
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.04] tracking-tight text-[var(--color-ink)] [text-wrap:balance] sm:text-5xl lg:text-6xl">
              {UI.heroTitle}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)] [text-wrap:pretty]">
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
        {/* fade into the next section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[var(--color-canvas)]" />
      </section>

      <main className="mx-auto max-w-6xl px-4">
        {/* ---- How it works: a fanned, isometric 3-step sequence ---- */}
        <section id="how-it-works" className="py-20 sm:py-28">
          <div className="text-center">
            <span className="font-mono text-[0.6875rem] font-medium text-[var(--color-muted)]">
              ٣ خطوات
            </span>
            <h2 className="mt-4 text-2xl font-bold text-[var(--color-ink)] sm:text-3xl">
              {UI.howItWorks}
            </h2>
          </div>
          <ol
            className="mt-16 grid gap-8 md:grid-cols-3"
            style={{ perspective: "1400px" }}
          >
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="card animate-floaty group p-6 transition-transform duration-300 hover:!translate-y-[-6px]"
                style={{
                  transform: `perspective(1400px) ${step.tilt} ${step.lift}`,
                  transformStyle: "preserve-3d",
                  animationDelay: step.delay,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-brand-200)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                    <step.Icon />
                  </span>
                  <span className="font-mono text-3xl font-bold text-[var(--color-line-strong)]">
                    {String(step.n).padStart(2, "0")}
                  </span>
                </div>
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

        {/* ---- Use cases ---- */}
        <section className="pb-20 sm:pb-28">
          <p className="text-center text-sm font-semibold text-[var(--color-muted)]">
            مناسب لمختلف الاستخدامات
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {USE_CASE_ORDER.map((useCase) => (
              <span
                key={useCase}
                className="chip border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-brand-500)] hover:text-[var(--color-brand-700)]"
              >
                {USE_CASE_LABELS[useCase]}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-start">
          <p className="text-sm font-semibold text-[var(--color-ink)]">{APP_NAME}</p>
          <p className="max-w-xl text-xs text-[var(--color-muted)]">{UI.privacyNote}</p>
        </div>
      </footer>
    </div>
  );
}
