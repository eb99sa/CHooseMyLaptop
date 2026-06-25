import { cn } from "@/lib/utils";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

interface StatCardProps {
  label: string;
  value: number | string;
  tone?: Tone;
}

const TONE_TEXT: Record<Tone, string> = {
  brand: "text-[var(--color-brand-700)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger: "text-[var(--color-danger)]",
  neutral: "text-[var(--color-ink)]",
};

// Server-safe presentational stat tile. Big number + Arabic label.
export function StatCard({ label, value, tone = "neutral" }: StatCardProps) {
  return (
    <div className="card p-5 animate-fadeup">
      <div className={cn("text-3xl font-extrabold leading-none", TONE_TEXT[tone])}>
        {value}
      </div>
      <div className="mt-2 text-sm text-[var(--color-muted)]">{label}</div>
    </div>
  );
}
