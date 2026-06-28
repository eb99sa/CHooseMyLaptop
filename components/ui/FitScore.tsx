import { clamp } from "@/lib/utils";

interface FitScoreProps {
  value: number; // 0..100
  label?: string;
  size?: number; // px
}

// Radial confidence dial — carbon ring on a pale track (monochrome by default).
export function FitScore({ value, label = "FIT", size = 96 }: FitScoreProps) {
  const v = clamp(Math.round(value), 0, 100);
  return (
    <div className="inline-flex shrink-0 flex-col items-center gap-2">
      <div
        className="relative grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background:
            `radial-gradient(closest-side, var(--color-surface) 79%, transparent 80% 100%),` +
            `conic-gradient(var(--color-ink) ${v}%, var(--color-line) 0)`,
        }}
      >
        <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_var(--color-line)]" />
        <span
          className="font-bold leading-none tabular-nums text-[var(--color-ink)]"
          style={{ fontSize: Math.round(size * 0.26) }}
        >
          {v}
        </span>
      </div>
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-[var(--color-faint)]">
        {label}
      </span>
    </div>
  );
}
