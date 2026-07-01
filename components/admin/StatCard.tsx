import { cn } from "@/lib/utils";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

interface StatCardProps {
  label: string;
  value: number | string;
  tone?: Tone;
}

// Tone accent lives only in a small state dot next to the label — the big numeral
// stays achromatic ink per the monochrome design contract.
const TONE_DOT: Record<Tone, string> = {
  brand: "bg-[var(--color-brand-700)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  neutral: "bg-[var(--color-line-strong)]",
};

// Server-safe presentational stat tile. Big number + Arabic label.
export function StatCard({ label, value, tone = "neutral" }: StatCardProps) {
  return (
    <div className="card p-5 animate-fadeup">
      <div className="text-3xl font-extrabold leading-none text-[var(--color-ink)]">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <span
          className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
          aria-hidden="true"
        />
        {label}
      </div>
    </div>
  );
}
