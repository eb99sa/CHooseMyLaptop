import { clamp } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  value: number; // 0..100
}

function colorFor(value: number): string {
  if (value >= 75) return "var(--color-success)";
  if (value >= 50) return "var(--color-brand-600)";
  if (value >= 35) return "var(--color-warning)";
  return "var(--color-danger)";
}

export function ScoreBar({ label, value }: ScoreBarProps) {
  const v = clamp(Math.round(value), 0, 100);
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className="font-bold tabular-nums">{v}</span>
      </div>
      <div className="h-2 rounded-full bg-[rgba(150,200,178,0.1)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${v}%`,
            background: colorFor(v),
            boxShadow: `0 0 12px ${colorFor(v)}`,
          }}
        />
      </div>
    </div>
  );
}
