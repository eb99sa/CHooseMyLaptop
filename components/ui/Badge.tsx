import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral" | "signal";

// Achromatic chips: soft token tint + deep text. Color is reserved for the
// semantic tones (success/warning/danger) and the `signal` neon dot.
const TONES: Record<Tone, string> = {
  neutral: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
  brand: "bg-[var(--color-brand-50)] text-[var(--color-ink)]",
  success: "bg-[var(--tint-success)] text-[var(--color-success)]",
  warning: "bg-[var(--tint-warning)] text-[var(--color-warning)]",
  danger: "bg-[var(--tint-danger)] text-[var(--color-danger)]",
  signal: "bg-[var(--color-surface-2)] text-[var(--color-ink)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Show a leading neon scene dot (implied for the `signal` tone). */
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot, className, children, ...props }: BadgeProps) {
  const showDot = dot ?? tone === "signal";
  return (
    <span className={cn("chip", TONES[tone], className)} {...props}>
      {showDot && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-[var(--scene-cyan)] shadow-[var(--glow-soft)]"
        />
      )}
      {children}
    </span>
  );
}
