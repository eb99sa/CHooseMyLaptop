import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { createSessionWithQuestions } from "@/lib/services/sessions";
import { normalizeBasicNeeds } from "@/lib/validation";

export const runtime = "nodejs";

// POST /api/sessions — create a session from Page 1 + generate follow-ups.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const basic = normalizeBasicNeeds(body);
  if (!basic) {
    return NextResponse.json(
      { error: "missing_or_invalid_fields", message: "الميزانية ونوع الاستخدام مطلوبان." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { sessionId } = await createSessionWithQuestions(supabase, user.id, basic);
    return NextResponse.json({ session_id: sessionId });
  } catch (err) {
    return NextResponse.json(
      { error: "server_error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
