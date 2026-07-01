import { createServiceClient, isDbConfigured } from "@/lib/supabase/service";
import { isAdminRequest } from "@/lib/admin-cookies";
import { toCsv } from "@/lib/utils";

export const runtime = "nodejs";

type ExportType = "sessions" | "listings";

// Anonymous sessions export intentionally omits the token hash and any exact
// coordinates — only approximate area is stored, and we export that.
const TABLES: Record<ExportType, { table: string; columns: string[]; order: string }> = {
  sessions: {
    table: "anonymous_recommendation_sessions",
    columns: [
      "id",
      "status",
      "primary_use_case",
      "budget_min",
      "budget_max",
      "currency",
      "country",
      "city_or_area",
      "location_source",
      "created_at",
    ],
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
      "country",
      "city_or_area",
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
};

// GET /api/admin/export?type=sessions|listings (admin cookie required).
export async function GET(req: Request) {
  if (!(await isAdminRequest())) {
    return new Response("forbidden", { status: 403 });
  }
  if (!isDbConfigured()) {
    return new Response("not_configured", { status: 503 });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "sessions") as ExportType;
  const config = TABLES[type];
  if (!config) {
    return new Response("invalid type", { status: 400 });
  }

  try {
    const admin = createServiceClient();
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
    console.error("admin export route error", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
