import Link from "next/link";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Logo } from "@/components/ui/Logo";
import { UI } from "@/lib/i18n";

// Shown when the magic-link code is missing, expired, or already used.
export default function AuthCodeErrorPage() {
  return (
    <>
      <SiteHeader email={null} />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10">
        <div className="card w-full p-6 sm:p-8 text-center animate-fadeup">
          <div className="mb-6 flex flex-col items-center gap-3">
            <Logo />
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              {UI.authError}
            </p>
          </div>
          <Link href="/login" className="btn btn-primary w-full">
            {UI.loginTitle}
          </Link>
        </div>
      </main>
    </>
  );
}
