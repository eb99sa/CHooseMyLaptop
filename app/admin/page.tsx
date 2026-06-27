import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Charts } from "@/components/admin/Charts";
import { ExportButtons } from "@/components/admin/ExportButtons";
import { StatCard } from "@/components/admin/StatCard";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { isAdminRequest } from "@/lib/admin-cookies";
import { USE_CASE_LABELS, UI } from "@/lib/i18n";
import { formatDate, safeJsonParse } from "@/lib/utils";
import type { FinalReport, LocationSource, UseCase } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Datum {
  name: string;
  value: number;
}

interface SessionRow {
  id: string;
  status: string | null;
  primary_use_case: string | null;
  budget_min: number | null;
  budget_max: number | null;
  location_source: string | null;
  country: string | null;
  created_at: string;
  recommendation_result_json: unknown;
}

interface ActivityRow {
  event_type: string | null;
  created_at: string;
  event_payload: unknown;
}

// Arabic labels for the session-status pie chart.
const STATUS_LABELS: Record<string, string> = {
  questions_ready: "أسئلة جاهزة",
  answered: "تمت الإجابة",
  completed: "مكتملة",
  failed: "فاشلة",
};

// Arabic labels for the location-source distribution chart.
const LOCATION_SOURCE_LABELS: Record<LocationSource, string> = {
  browser_geolocation: "تحديد تلقائي من المتصفح",
  manual_search: "بحث يدوي",
  skipped: "تم التخطّي",
};

const BUDGET_BUCKETS = [
  { name: "أقل من 150", min: 0, max: 150 },
  { name: "150 - 250", min: 150, max: 250 },
  { name: "250 - 350", min: 250, max: 350 },
  { name: "أكثر من 350", min: 350, max: Infinity },
];

function useCaseLabel(key: string | null): string {
  if (!key) return "غير محدد";
  return USE_CASE_LABELS[key as UseCase] ?? key;
}

function locationSourceLabel(key: string | null): string {
  if (!key) return "غير محدد";
  return LOCATION_SOURCE_LABELS[key as LocationSource] ?? key;
}

function aggregate(sessions: SessionRow[]) {
  // Status counts.
  const statusCounts = new Map<string, number>();
  for (const s of sessions) {
    const key = s.status ?? "questions_ready";
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
  }
  const completed = statusCounts.get("completed") ?? 0;
  const failed = statusCounts.get("failed") ?? 0;
  // Incomplete = everything that is neither completed nor failed.
  const incomplete = sessions.length - completed - failed;

  const statuses: Datum[] = Array.from(statusCounts.entries())
    .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);

  // Popular use cases.
  const useCaseCounts = new Map<string, number>();
  for (const s of sessions) {
    const key = s.primary_use_case ?? "";
    if (!key) continue;
    useCaseCounts.set(key, (useCaseCounts.get(key) ?? 0) + 1);
  }
  const useCases: Datum[] = Array.from(useCaseCounts.entries())
    .map(([k, v]) => ({ name: useCaseLabel(k), value: v }))
    .sort((a, b) => b.value - a.value);

  // Budget buckets (from budget_max).
  const bucketCounts = BUDGET_BUCKETS.map((b) => ({ ...b, count: 0 }));
  for (const s of sessions) {
    const max = s.budget_max;
    if (max == null) continue;
    const bucket = bucketCounts.find((b) => max >= b.min && max < b.max);
    if (bucket) bucket.count += 1;
  }
  const budgets: Datum[] = bucketCounts.map((b) => ({ name: b.name, value: b.count }));

  // Location-source distribution.
  const locationCounts = new Map<string, number>();
  for (const s of sessions) {
    const key = s.location_source ?? "";
    if (!key) continue;
    locationCounts.set(key, (locationCounts.get(key) ?? 0) + 1);
  }
  const locationSources: Datum[] = Array.from(locationCounts.entries())
    .map(([k, v]) => ({ name: locationSourceLabel(k), value: v }))
    .sort((a, b) => b.value - a.value);

  // Most recommended models — parse each session's stored report defensively and
  // read best_overall.listing.product_title.
  const modelCounts = new Map<string, number>();
  for (const s of sessions) {
    const report = safeJsonParse<FinalReport | null>(s.recommendation_result_json, null);
    const title = report?.best_overall?.listing?.product_title;
    if (!title) continue;
    modelCounts.set(title, (modelCounts.get(title) ?? 0) + 1);
  }
  const models: Datum[] = Array.from(modelCounts.entries())
    .map(([name, v]) => ({ name, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    total: sessions.length,
    completed,
    failed,
    incomplete,
    statuses,
    useCases,
    budgets,
    models,
    locationSources,
  };
}

export default async function AdminDashboardPage() {
  if (!(await isAdminRequest())) redirect("/admin/login");

  // Service-role client may throw if credentials are missing.
  let adminError = false;
  let agg: ReturnType<typeof aggregate> | null = null;
  let activity: ActivityRow[] = [];

  if (!isDbConfigured()) {
    adminError = true;
  } else {
    try {
      const admin = createServiceClient();

      const [sessionsRes, activityRes] = await Promise.all([
        admin
          .from("anonymous_recommendation_sessions")
          .select(
            "id,status,primary_use_case,budget_min,budget_max,location_source,country,created_at,recommendation_result_json",
          )
          .limit(5000),
        admin
          .from("admin_analytics_events")
          .select("event_type,created_at,event_payload")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (sessionsRes.error) throw new Error(sessionsRes.error.message);

      const sessions = (sessionsRes.data ?? []) as SessionRow[];
      activity = (activityRes.data ?? []) as ActivityRow[];

      agg = aggregate(sessions);
    } catch {
      adminError = true;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)]">{UI.adminTitle}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              نظرة عامة على الجلسات والتوصيات وأكثر الأجهزة ترشيحاً.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/listings" className="btn btn-ghost text-sm">
              إدارة الأجهزة ←
            </Link>
            <AdminSignOut />
          </div>
        </div>

        {adminError || !agg ? (
          <div className="card p-6 animate-fadeup">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              لوحة الإدارة غير مُفعّلة
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              لعرض الإحصائيات تحتاج إلى ضبط متغيّرات قاعدة البيانات على الخادم{" "}
              <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono text-[var(--color-ink)]">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              و{" "}
              <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono text-[var(--color-ink)]">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              في إعدادات المشروع، ثم إعادة التشغيل. تُستخدم هذه المفاتيح على الخادم فقط
              لتجميع البيانات بأمان.
            </p>
          </div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="إجمالي الجلسات" value={agg.total} tone="brand" />
              <StatCard label="جلسات مكتملة" value={agg.completed} tone="success" />
              <StatCard label="جلسات فاشلة" value={agg.failed} tone="danger" />
              <StatCard label="جلسات غير مكتملة" value={agg.incomplete} tone="warning" />
            </section>

            <section className="mb-8">
              <Charts
                useCases={agg.useCases}
                budgets={agg.budgets}
                models={agg.models}
                statuses={agg.statuses}
                locationSources={agg.locationSources}
              />
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold text-[var(--color-ink)]">تصدير البيانات</h2>
              <ExportButtons />
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold text-[var(--color-ink)]">آخر النشاطات</h2>
              <div className="card p-0 overflow-hidden">
                {activity.length === 0 ? (
                  <p className="p-5 text-sm text-[var(--color-muted)]">لا توجد نشاطات بعد.</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-line)]">
                    {activity.map((a, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                      >
                        <span className="font-medium text-[var(--color-ink)]">
                          {a.event_type ?? "حدث"}
                        </span>
                        <span className="shrink-0 text-[var(--color-muted)]">
                          {formatDate(a.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
