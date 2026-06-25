import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Logo } from "@/components/ui/Logo";
import { UI } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";

// Server component shell for the magic-link login page.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const redirectParam = sp.redirect;
  // Reject protocol-relative / backslash paths to prevent open redirects.
  const redirectTo =
    typeof redirectParam === "string" && /^\/(?![/\\])/.test(redirectParam)
      ? redirectParam
      : "/dashboard";

  const errorParam = sp.error;
  const hasError = typeof errorParam === "string" && errorParam.length > 0;

  return (
    <>
      <SiteHeader email={null} />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10">
        <div className="card w-full p-6 sm:p-8 animate-fadeup">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Logo />
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)]">
              {UI.loginTitle}
            </h1>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              {UI.loginSubtitle}
            </p>
          </div>

          {hasError && (
            <div className="mb-4 rounded-[var(--radius-card)] border border-[var(--color-danger)] bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
              {UI.authError}
            </div>
          )}

          <LoginForm redirectTo={redirectTo} />
        </div>
      </main>
    </>
  );
}
