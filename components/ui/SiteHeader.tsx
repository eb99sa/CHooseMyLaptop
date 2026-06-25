import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { isAdminEmail } from "@/lib/utils";

interface SiteHeaderProps {
  email?: string | null;
  showDashboardLink?: boolean;
}

// Server component. Renders top navigation; only shows sign-out when logged in.
export function SiteHeader({ email, showDashboardLink = true }: SiteHeaderProps) {
  const admin = isAdminEmail(email);
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href={email ? "/dashboard" : "/"} aria-label="الرئيسية">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          {email ? (
            <>
              {showDashboardLink && (
                <Link href="/dashboard" className="btn btn-ghost text-sm">
                  لوحتي
                </Link>
              )}
              {admin && (
                <Link href="/admin" className="btn btn-ghost text-sm">
                  الإدارة
                </Link>
              )}
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="btn btn-primary text-sm">
              تسجيل الدخول
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
