import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { UI } from "@/lib/i18n";

// Transparent EMO nav — no visible surface, no border; it sits on the charcoal
// canvas (opaque charcoal only so scrolled content is occluded cleanly). Left:
// brand mark. Right: one ghost nav action.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-[var(--color-canvas)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" aria-label="الرئيسية">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/sessions/new" className="btn btn-ghost btn-sm">
            {UI.newSession}
          </Link>
        </nav>
      </div>
    </header>
  );
}
