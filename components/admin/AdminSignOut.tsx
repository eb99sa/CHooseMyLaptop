"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UI } from "@/lib/i18n";

// Client control: clears the admin cookie via DELETE /api/admin/login, then
// returns to the admin login screen.
export function AdminSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/admin/login", { method: "DELETE" });
    } catch {
      // Ignore network errors; we still send the user back to the login page.
    } finally {
      router.push("/admin/login");
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost text-sm"
      onClick={handleSignOut}
      disabled={busy}
    >
      {busy ? UI.loading : UI.adminSignOut}
    </button>
  );
}
