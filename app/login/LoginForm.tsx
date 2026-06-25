"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { UI } from "@/lib/i18n";

interface LoginFormProps {
  redirectTo?: string;
}

// Client component: collects an email and triggers a Supabase magic-link sign-in.
export function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setError("الرجاء إدخال بريد إلكتروني صالح.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const next = redirectTo || "/dashboard";
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (otpError) {
        setError("تعذّر إرسال الرابط. تأكّد من البريد وحاول مرة أخرى.");
        return;
      }

      setSent(true);
    } catch {
      setError("حدث خطأ غير متوقع. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div
        className="rounded-[var(--radius-card)] border border-[var(--color-success)] bg-[var(--color-success)]/10 px-4 py-4 text-center text-sm font-bold text-[var(--color-success)]"
        role="status"
      >
        {UI.magicLinkSent}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label={UI.emailLabel} htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          className="input text-left"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </Field>

      {error && (
        <p className="text-sm font-bold text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={loading}>
        {loading ? UI.loading : UI.sendMagicLink}
      </Button>
    </form>
  );
}
