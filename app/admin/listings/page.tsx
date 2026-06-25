import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Badge } from "@/components/ui/Badge";
import { getCurrentUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatPrice, isAdminEmail } from "@/lib/utils";
import { UI } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ListingRow {
  id: string;
  product_title: string | null;
  brand: string | null;
  store_name: string | null;
  price: number | string | null;
  currency: string | null;
  availability: string | null;
  rating: number | string | null;
  source_type: string | null;
  last_checked_at: string | null;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  in_stock: "متوفر",
  out_of_stock: "غير متوفر",
  preorder: "طلب مسبق",
  unknown: "غير معروف",
};

const AVAILABILITY_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  in_stock: "success",
  out_of_stock: "danger",
  preorder: "warning",
  unknown: "neutral",
};

const SOURCE_LABELS: Record<string, string> = {
  seed: "بيانات أولية",
  scraped: "مستخرجة",
  manual: "يدوية",
};

export default async function AdminListingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  let adminError = false;
  let rows: ListingRow[] = [];

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("laptop_listings")
      .select(
        "id,product_title,brand,store_name,price,currency,availability,rating,source_type,last_checked_at",
      )
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as ListingRow[];
  } catch {
    adminError = true;
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <SiteHeader email={user.email} showDashboardLink />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)]">إدارة الأجهزة</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {adminError ? "" : `إجمالي الأجهزة: ${rows.length}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="btn btn-ghost text-sm">
              → لوحة الإدارة
            </Link>
            <a href="/api/admin/export?type=listings" className="btn btn-primary text-sm">
              {UI.exportCsv}
            </a>
          </div>
        </div>

        {adminError ? (
          <div className="card p-6 animate-fadeup">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              لوحة الإدارة غير مُفعّلة
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              لعرض الأجهزة تحتاج إلى ضبط متغيّر البيئة{" "}
              <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono text-[var(--color-ink)]">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              في إعدادات المشروع، ثم إعادة التشغيل.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              هذه القائمة للعرض فقط في النسخة الأولى. إضافة الأجهزة وتعديلها ميزة قادمة في
              المرحلة الثانية.
            </p>

            <div className="card p-0 overflow-x-auto">
              {rows.length === 0 ? (
                <p className="p-6 text-sm text-[var(--color-muted)]">لا توجد أجهزة بعد.</p>
              ) : (
                <table className="w-full min-w-[760px] border-collapse text-right text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                      <th className="px-4 py-3 font-semibold">الجهاز</th>
                      <th className="px-4 py-3 font-semibold">العلامة</th>
                      <th className="px-4 py-3 font-semibold">المتجر</th>
                      <th className="px-4 py-3 font-semibold">السعر</th>
                      <th className="px-4 py-3 font-semibold">التوفر</th>
                      <th className="px-4 py-3 font-semibold">التقييم</th>
                      <th className="px-4 py-3 font-semibold">المصدر</th>
                      <th className="px-4 py-3 font-semibold">آخر تحقّق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const avail = r.availability ?? "unknown";
                      const rating = r.rating != null ? Number(r.rating) : null;
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-canvas)]"
                        >
                          <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                            {r.product_title ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">{r.brand || "—"}</td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">
                            {r.store_name || "—"}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-ink)] whitespace-nowrap">
                            {r.price != null
                              ? formatPrice(Number(r.price), r.currency ?? "KWD")
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={AVAILABILITY_TONE[avail] ?? "neutral"}>
                              {AVAILABILITY_LABELS[avail] ?? avail}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)] whitespace-nowrap">
                            {rating != null ? `${rating.toFixed(1)} / 5` : "—"}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)]">
                            {SOURCE_LABELS[r.source_type ?? ""] ?? r.source_type ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-muted)] whitespace-nowrap">
                            {formatDate(r.last_checked_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
