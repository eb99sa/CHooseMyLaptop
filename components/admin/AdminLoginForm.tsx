"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UI } from "@/lib/i18n";

// Client form: posts the admin password to /api/admin/login and routes to the
// dashboard on success. Server sets the admin cookie; the browser never sees it.
export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/admin");
        return;
      }
      if (res.status === 503) {
        setError(UI.adminNotConfigured);
      } else {
        setError(UI.adminLoginError);
      }
    } catch {
      setError(UI.adminLoginError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="admin-password"
          className="block text-sm font-bold text-[var(--color-ink)]"
        >
          {UI.adminPasswordLabel}
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "admin-password-error" : undefined}
          required
        />
      </div>

      {error && (
        <p
          id="admin-password-error"
          role="alert"
          className="text-sm font-medium text-[var(--color-danger)]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={submitting || password.length === 0}
      >
        {submitting ? UI.loading : UI.adminLoginBtn}
      </button>
    </form>
  );
}
