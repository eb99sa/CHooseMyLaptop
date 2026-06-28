"use client";

import { useEffect, useState } from "react";

interface NarrowingLoaderProps {
  from?: number;
  to?: number;
  total?: number;
  label?: string;
  litIndex?: number;
  /** Show the live model count + "FROM N MODELS". Off for non-model loads. */
  showCount?: boolean;
}

// The loading state — never a spinner. A live count over contracting bars
// communicates "we're narrowing the laptops", not "please wait".
export function NarrowingLoader({
  from = 120,
  to = 14,
  total = 120,
  label = "نضيّق الخيارات…",
  litIndex = 2,
  showCount = true,
}: NarrowingLoaderProps) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!showCount) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCount(to);
      return;
    }
    let n = from;
    setCount(n);
    const id = setInterval(() => {
      n = Math.max(to, n - Math.ceil(n * 0.16));
      setCount(n);
      if (n <= to) clearInterval(id);
    }, 190);
    return () => clearInterval(id);
  }, [from, to, showCount]);

  return (
    <div
      className="flex w-full max-w-[360px] flex-col items-stretch gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-baseline gap-2 font-mono text-sm text-[var(--color-muted)]">
        {showCount && (
          <b className="text-2xl font-bold tabular-nums text-[var(--color-ink)]">{count}</b>
        )}
        <span>{label}</span>
      </div>
      <div className="flex flex-col gap-[7px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => {
          const lit = i === litIndex;
          return (
            <span
              key={i}
              className="animate-narrow h-2 origin-right rounded-full"
              style={{
                width: `${100 - i * 13}%`,
                background: lit
                  ? "var(--scene-cyan)"
                  : i % 2
                    ? "var(--color-line-strong)"
                    : "var(--color-line)",
                boxShadow: lit ? "var(--glow-soft)" : undefined,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          );
        })}
      </div>
      {showCount && total != null && (
        <div className="eyebrow" dir="ltr">
          FROM {total} MODELS
        </div>
      )}
    </div>
  );
}
