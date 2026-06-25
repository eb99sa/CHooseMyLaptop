import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Charts } from "@/components/admin/Charts";
import { ExportButtons } from "@/components/admin/ExportButtons";
import { StatCard } from "@/components/admin/StatCard";
import { getCurrentUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { USE_CASE_LABELS, UI } from "@/lib/i18n";
import { formatDate, isAdminEmail } from "@/lib/utils";
import type { UseCase } from "@/lib/types";

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
  created_at: string;
}

interface ResultRow {
  laptop_listing_id: string | null;
  recommendation_type: string | null;
}

interface ListingTitleRow {
  id: string;
  product_title: string | null;
}

interface ActivityRow {
  event_type: string | null;
  created_at: string;
  event_payload: unknown;
}

// Arabic labels for the session-status pie chart.
const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  questions_ready: "أسئلة جاهزة",
  answered: "تمت الإجابة",
  completed: "مكتملة",
  failed: "فاشلة",
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

function aggregate(sessions: SessionRow[], results: ResultRow[], titleMap: Map<string, string>) {
  // Status counts.
  const statusCounts = new Map<string, number>();
  for (const s of sessions) {
    const key = s.status ?? "draft";
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

  // Most recommended models (best_overall only).
  const modelCounts = new Map<string, number>();
  for (const r of results) {
    if (r.recommendation_type !== "best_overall") continue;
    if (!r.laptop_listing_id) continue;
    modelCounts.set(r.laptop_listing_id, (modelCounts.get(r.laptop_listing_id) ?? 0) + 1);
  }
  const models: Datum[] = Array.from(modelCounts.entries())
    .map(([id, v]) => ({ name: titleMap.get(id) ?? id.slice(0, 8), value: v }))
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
  };
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  // Service-role client may throw if SUPABASE_SERVICE_ROLE_KEY is missing.
  let adminError = false;
  let agg: ReturnType<typeof aggregate> | null = null;
  let activity: ActivityRow[] = [];

  try {
    const admin = createSupabaseAdminClient();

    const [sessionsRes, resultsRes, activityRes] = await Promise.all([
      admin
        .from("recommendation_sessions")
        .select("id,status,primary_use_case,budget_min,budget_max,created_at")
        .limit(5000),
      admin
        .from("recommendation_results")
        .select("laptop_listing_id,recommendation_type")
        .eq("recommendation_type", "best_overall")
        .limit(5000),
      admin
        .from("admin_analytics_events")
        .select("event_type,created_at,event_payload")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const sessions = (sessionsRes.data ?? []) as SessionRow[];
    const results = (resultsRes.data ?? []) as ResultRow[];
    activity = (activityRes.data ?? []) as ActivityRow[];

    // Map listing ids -> titles for the "most recommended" chart.
    const ids = Array.from(
      new Set(results.map((r) => r.laptop_listing_id).filter((x): x is string => Boolean(x))),
    );
    const titleMap = new Map<string, string>();
    if (ids.length) {
      const { data: listingRows } = await admin
        .from("laptop_listings")
        .select("id,product_title")
        .in("id", ids);
      for (const row of (listingRows ?? []) as ListingTitleRow[]) {
        titleMap.set(row.id, row.product_title ?? row.id.slice(0, 8));
      }
    }

    agg = aggregate(sessions, results, titleMap);
  } catch {
    adminError = true;
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <SiteHeader email={user.email} showDashboardLink />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)]">{UI.adminTitle}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              نظرة عامة على الجلسات والتوصيات وأكثر الأجهزة ترشيحاً.
            </p>
          </div>
          <Link href="/admin/listings" className="btn btn-ghost text-sm">
            إدارة الأجهزة ←
          </Link>
        </div>

        {adminError || !agg ? (
          <div className="card p-6 animate-fadeup">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              لوحة الإدارة غير مُفعّلة
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              لعرض الإحصائيات تحتاج إلى ضبط متغيّر البيئة{" "}
              <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono text-[var(--color-ink)]">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              في إعدادات المشروع، ثم إعادة التشغيل. هذا المفتاح يُستخدم فقط على الخادم
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
