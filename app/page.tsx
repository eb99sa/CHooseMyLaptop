import Link from "next/link";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Card, CardTitle, CardMuted } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/supabase/server";
import { APP_NAME, UI, USE_CASE_LABELS, USE_CASE_ORDER } from "@/lib/i18n";
// Hero3D is a self-contained "use client" component. It mount-gates its WebGL
// canvas so it never renders during SSR — safe to import directly from this
// Server Component (which cannot legally pass ssr:false to next/dynamic).
import Hero3D from "@/components/landing/Hero3D";

const STEPS = [
  { icon: "📝", title: UI.step1Title, body: UI.step1Body },
  { icon: "🤖", title: UI.step2Title, body: UI.step2Body },
  { icon: "🎯", title: UI.step3Title, body: UI.step3Body },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const ctaHref = user ? "/sessions/new" : "/login";

  return (
    <div className="min-h-screen">
      <SiteHeader email={user?.email} />

      <main className="mx-auto max-w-6xl px-4">
        {/* Hero */}
        <section className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12">
          <div className="animate-fadeup">
            <h1 className="text-3xl font-extrabold leading-tight text-[var(--color-ink)] sm:text-4xl lg:text-5xl">
              {UI.heroTitle}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
              {UI.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={ctaHref} className="btn btn-primary text-base">
                {UI.ctaStart}
              </Link>
              <Link href="#how-it-works" className="btn btn-ghost text-base">
                {UI.howItWorks}
              </Link>
            </div>
          </div>

          <div className="animate-fadeup">
            <Hero3D />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-12 sm:py-16">
          <h2 className="text-center text-2xl font-bold text-[var(--color-ink)] sm:text-3xl">
            {UI.howItWorks}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step) => (
              <Card key={step.title} className="animate-fadeup text-center">
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl"
                  aria-hidden
                >
                  {step.icon}
                </div>
                <CardTitle>{step.title}</CardTitle>
                <CardMuted className="mt-2">{step.body}</CardMuted>
              </Card>
            ))}
          </div>
        </section>

        {/* Use cases strip */}
        <section className="pb-12 sm:pb-16">
          <p className="text-center text-sm font-semibold text-[var(--color-muted)]">
            مناسب لمختلف الاستخدامات
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {USE_CASE_ORDER.map((useCase) => (
              <span
                key={useCase}
                className="chip border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]"
              >
                {USE_CASE_LABELS[useCase]}
              </span>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-start">
          <p className="text-sm font-semibold text-[var(--color-ink)]">{APP_NAME}</p>
          <p className="text-xs text-[var(--color-muted)]">
            نسخة تجريبية (MVP) — بعض البيانات تقديرية. تأكّد من السعر والتوفر قبل الشراء.
          </p>
        </div>
      </footer>
    </div>
  );
}
