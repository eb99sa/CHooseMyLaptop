import Link from "next/link";
import { redirect } from "next/navigation";
import { SessionCard } from "@/components/dashboard/SessionCard";
import { Card, CardMuted } from "@/components/ui/Card";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { UI } from "@/lib/i18n";
import {
  createSupabaseServerClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import type { RecommendationSessionRow } from "@/lib/types";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("recommendation_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  const sessions = (data ?? []) as RecommendationSessionRow[];

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <SiteHeader email={user.email} showDashboardLink={false} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            {UI.dashboardTitle}
          </h1>
          <Link href="/sessions/new" className="btn btn-primary">
            {UI.newSession}
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-[var(--color-ink)]">
            {UI.mySessions}
          </h2>

          {sessions.length === 0 ? (
            <Card className="flex flex-col items-center gap-4 py-12 text-center animate-fadeup">
              <CardMuted className="text-base">{UI.noSessions}</CardMuted>
              <Link href="/sessions/new" className="btn btn-primary">
                {UI.newSession}
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
