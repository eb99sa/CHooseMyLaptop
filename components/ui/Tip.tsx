"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TipProps {
  trigger: ReactNode;
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
  className?: string;
}

const TONE: Record<NonNullable<TipProps["tone"]>, string> = {
  neutral: "border-[var(--color-line)] text-[var(--color-muted)]",
  success: "border-[color-mix(in_srgb,var(--color-success)_45%,var(--color-line))] text-[var(--color-success)]",
  warning: "border-[color-mix(in_srgb,var(--color-warning)_45%,var(--color-line))] text-[var(--color-warning)]",
};

/**
 * A compact symbol whose detail reveals on TAP (mobile) or hover (desktop), and closes on
 * outside-tap or Escape. Lets an icon-led report stay terse while keeping the info one tap away.
 * Client island — safe to drop into server components.
 */
export function Tip({ trigger, children, tone = "neutral", className }: TipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold transition-colors hover:border-[var(--color-line-strong)]",
          TONE[tone],
        )}
      >
        {trigger}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full start-0 z-20 mb-2 w-60 max-w-[80vw] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-start text-xs leading-relaxed text-[var(--color-ink)] shadow-[var(--shadow-lift)]"
        >
          {children}
        </span>
      )}
    </span>
  );
}
