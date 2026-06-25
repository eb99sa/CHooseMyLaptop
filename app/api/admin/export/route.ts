import { getCurrentUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail, toCsv } from "@/lib/utils";

export const runtime = "nodejs";

type ExportType = "sessions" | "answers" | "listings" | "results";

const TABLES: Record<ExportType, { table: string; columns: string[]; order: string }> = {
  sessions: {
    table: "recommendation_sessions",
    columns: [
      "id",
      "user_id",
      "status",
      "primary_use_case",
      "budget_min",
      "budget_max",
      "currency",
      "country",
      "city",
      "created_at",
      "updated_at",
    ],
    order: "created_at",
  },
  answers: {
    table: "user_answers",
    columns: ["id", "session_id", "question_key", "question_text", "answer_value", "answer_type", "created_at"],
    order: "created_at",
  },
  listings: {
    table: "laptop_listings",
    columns: [
      "id",
      "store_name",
      "product_title",
      "brand",
      "model",
      "price",
      "currency",
      "availability",
      "rating",
      "review_count",
      "source_type",
      "url",
      "specs_json",
      "last_checked_at",
      "created_at",
    ],
    order: "created_at",
  },
  results: {
    table: "recommendation_results",
    columns: [
      "id",
      "session_id",
      "laptop_listing_id",
      "recommendation_type",
      "fit_score",
      "roi_score",
      "final_score",
      "reasoning",
      "warnings_json",
      "created_at",
    ],
    order: "created_at",
  },
};

// GET /api/admin/export?type=sessions|answers|listings|results
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return new Response("forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "sessions") as ExportType;
  const config = TABLES[type];
  if (!config) {
    return new Response("invalid type", { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from(config.table)
      .select(config.columns.join(","))
      .order(config.order, { ascending: false })
      .limit(5000);

    if (error) throw new Error(error.message);

    const csv = toCsv(
      config.columns,
      (data ?? []) as unknown as Array<Record<string, unknown>>,
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}.csv"`,
      },
    });
  } catch (err) {
    return new Response(`export_error: ${(err as Error).message}`, { status: 500 });
  }
}
