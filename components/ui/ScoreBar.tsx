import { clamp } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger";

// Carbon fill by default — restrained, monochrome. Color is opt-in via `tone`
// (e.g. for a fit breakdown where good/poor matters).
const FILL: Record<Tone, string> = {
  neutral: "var(--color-ink)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

interface ScoreBarProps {
  label: string;
  value: number; // 0..100
  tone?: Tone;
  showValue?: boolean;
}

export function ScoreBar({ label, value, tone = "neutral", showValue = true }: ScoreBarProps) {
  const v = clamp(Math.round(value), 0, 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-[var(--color-muted)]">{label}</span>
        {showValue && (
          <span className="font-bold tabular-nums text-[var(--color-ink)]">{v}</span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)] ring-1 ring-[var(--color-line)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${v}%`, background: FILL[tone] }}
        />
      </div>
    </div>
  );
}
