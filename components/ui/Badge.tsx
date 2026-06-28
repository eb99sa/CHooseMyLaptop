import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

// Dark-theme tones: a translucent wash of the hue + a bright on-dark text color,
// each with a hairline ring so they read as crisp neon chips.
const TONES: Record<Tone, string> = {
  brand: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] ring-1 ring-[var(--color-brand-200)]",
  success: "bg-[rgba(70,226,160,0.12)] text-[var(--color-success)] ring-1 ring-[rgba(70,226,160,0.3)]",
  warning: "bg-[rgba(244,197,96,0.12)] text-[var(--color-warning)] ring-1 ring-[rgba(244,197,96,0.3)]",
  danger: "bg-[rgba(255,111,111,0.12)] text-[var(--color-danger)] ring-1 ring-[rgba(255,111,111,0.32)]",
  neutral: "bg-[rgba(150,200,178,0.08)] text-[var(--color-muted)] ring-1 ring-[var(--color-line)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return <span className={cn("chip", TONES[tone], className)} {...props} />;
}
