import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

const TONES: Record<Tone, string> = {
  brand: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return <span className={cn("chip", TONES[tone], className)} {...props} />;
}
