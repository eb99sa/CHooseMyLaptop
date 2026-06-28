import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { UI } from "@/lib/i18n";

// Server component. Anonymous app: no auth, no email, no admin links.
// Left: brand logo linking home. Right: a single "new recommendation" ghost link.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-canvas)]/92">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="الرئيسية">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/sessions/new" className="btn btn-ghost text-sm">
            {UI.newSession}
          </Link>
        </nav>
      </div>
    </header>
  );
}
