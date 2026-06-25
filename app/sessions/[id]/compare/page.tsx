import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { UI } from "@/lib/i18n";
import { cn, formatPrice, safeJsonParse } from "@/lib/utils";
import type {
  FinalReport,
  RecommendationSessionRow,
  ScoredLaptop,
} from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CompareRow {
  label: string;
  render: (s: ScoredLaptop) => string;
  emphasis?: boolean;
}

// Comparison rows: spec/score fields read from each ScoredLaptop.
const ROWS: CompareRow[] = [
  { label: "السعر", render: (s) => formatPrice(s.listing.price, s.listing.currency) },
  { label: "المعالج", render: (s) => s.listing.specs.cpu },
  { label: "الذاكرة (RAM)", render: (s) => `${s.listing.specs.ram_gb} GB` },
  {
    label: "التخزين",
    render: (s) => `${s.listing.specs.storage_gb} GB ${s.listing.specs.storage_type}`,
  },
  { label: "كرت الشاشة", render: (s) => s.listing.specs.gpu },
  {
    label: "الشاشة",
    render: (s) =>
      `${s.listing.specs.display_inch}" ${s.listing.specs.display_panel}`,
  },
  { label: "البطارية", render: (s) => `${s.listing.specs.battery_hours} ساعات` },
  { label: "الوزن", render: (s) => `${s.listing.specs.weight_kg} كجم` },
  { label: UI.fitScore, render: (s) => String(Math.round(s.fit_score)), emphasis: true },
  { label: UI.roiScore, render: (s) => String(Math.round(s.roi_score)), emphasis: true },
  {
    label: UI.finalScore,
    render: (s) => String(Math.round(s.final_score)),
    emphasis: true,
  },
];

// Side-by-side comparison of the top scored laptops — server component.
export default async function ComparePage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("recommendation_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const session = data as RecommendationSessionRow | null;
  if (!session) redirect("/dashboard");

  const report = safeJsonParse<FinalReport | null>(session.report_json, null);
  if (!report || !report.scored?.length) {
    redirect(`/sessions/${id}/report`);
  }

  const laptops = report.scored.slice(0, 6);
  const bestId = report.best_overall?.listing.id;

  return (
    <>
      <SiteHeader email={user.email} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="animate-fadeup space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
              {UI.compare}
            </h1>
            <Link href={`/sessions/${id}/report`} className="btn btn-ghost text-sm">
              {UI.back} للتقرير
            </Link>
          </header>

          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  <th className="sticky start-0 z-10 bg-[var(--color-surface)] p-4 text-start font-bold text-[var(--color-muted)]">
                    المواصفة
                  </th>
                  {laptops.map((s) => {
                    const isBest = s.listing.id === bestId;
                    return (
                      <th
                        key={s.listing.id}
                        className={cn(
                          "p-4 text-start align-top",
                          isBest && "bg-[var(--color-brand-50)]",
                        )}
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-[var(--color-ink)]">
                            {s.listing.product_title}
                          </p>
                          {s.listing.brand && (
                            <p className="text-xs font-normal text-[var(--color-muted)]">
                              {s.listing.brand}
                            </p>
                          )}
                          {isBest && (
                            <span className="chip bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                              {UI.finalScore} الأعلى
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--color-line)] last:border-b-0">
                    <th className="sticky start-0 z-10 bg-[var(--color-surface)] p-4 text-start font-semibold text-[var(--color-muted)]">
                      {row.label}
                    </th>
                    {laptops.map((s) => {
                      const isBest = s.listing.id === bestId;
                      return (
                        <td
                          key={s.listing.id}
                          className={cn(
                            "p-4",
                            isBest && "bg-[var(--color-brand-50)]",
                            row.emphasis
                              ? "font-bold tabular-nums text-[var(--color-ink)]"
                              : "text-[var(--color-ink)]",
                          )}
                        >
                          {row.render(s)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
