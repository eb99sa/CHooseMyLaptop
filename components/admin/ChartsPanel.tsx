"use client";

import nextDynamic from "next/dynamic";
import type { ChartsProps } from "@/components/admin/Charts";

// Lazily load the heavy, admin-only Recharts bundle on the client, with a
// lightweight placeholder while the chunk loads. This wrapper is a Client
// Component because next/dynamic({ ssr: false }) is not allowed in a Server
// Component (Next.js 16) — the admin page is a Server Component.
const Charts = nextDynamic(() => import("@/components/admin/Charts").then((m) => m.Charts), {
  ssr: false,
  loading: () => (
    <div className="card flex h-[260px] items-center justify-center p-5 text-sm text-[var(--color-muted)]">
      نحمّل الإحصائيات…
    </div>
  ),
});

export function ChartsPanel(props: ChartsProps) {
  return <Charts {...props} />;
}
