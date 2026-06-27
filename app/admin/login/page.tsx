import { SiteHeader } from "@/components/ui/SiteHeader";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { UI } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin login screen. The form posts the password to the server, which validates
// it and sets the admin cookie. No account/email login exists in this app.
export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <SiteHeader />

      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <div className="card p-6 animate-fadeup sm:p-8">
          <h1 className="text-2xl font-extrabold text-[var(--color-ink)]">
            {UI.adminLoginTitle}
          </h1>
          <p className="mt-1 mb-6 text-sm text-[var(--color-muted)]">
            {UI.adminLoginSubtitle}
          </p>
          <AdminLoginForm />
        </div>
      </main>
    </div>
  );
}
