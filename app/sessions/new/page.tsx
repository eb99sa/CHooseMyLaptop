import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { BasicNeedsForm } from "@/components/forms/BasicNeedsForm";
import { UI } from "@/lib/i18n";

// Page 1 — Basic Needs. Server shell: guards auth, renders the client form.
export default async function NewSessionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <SiteHeader email={user.email} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <div className="animate-fadeup space-y-8">
          <ProgressSteps current={1} steps={["احتياجاتك", "أسئلة المتابعة"]} />

          <header className="space-y-2">
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
              {UI.basicNeedsTitle}
            </h1>
            <p className="text-sm text-[var(--color-muted)] sm:text-base">
              {UI.basicNeedsSubtitle}
            </p>
          </header>

          <BasicNeedsForm />
        </div>
      </main>
    </>
  );
}
