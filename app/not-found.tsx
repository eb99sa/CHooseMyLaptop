import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <h1 className="text-6xl font-extrabold text-[var(--color-brand-600)]">٤٠٤</h1>
      <p className="text-lg text-[var(--color-muted)]">الصفحة التي تبحث عنها غير موجودة.</p>
      <Link href="/" className="btn btn-primary">
        العودة إلى الرئيسية
      </Link>
    </main>
  );
}
