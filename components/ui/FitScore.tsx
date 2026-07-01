import { clamp } from "@/lib/utils";

interface FitScoreProps {
  value: number; // 0..100
  label?: string;
  size?: number; // px
  mode?: "hundred" | "ten"; // "ten" prints value/10 to 1 decimal (rating out of 10)
}

// Radial confidence dial — carbon ring on a pale track (monochrome by default).
// mode="ten" keeps the 0..100 arc fill but prints the value as a rating out of 10.
export function FitScore({ value, label, size = 96, mode = "hundred" }: FitScoreProps) {
  const v = clamp(Math.round(value), 0, 100); // arc fill stays 0..100
  const isTen = mode === "ten";
  const display = isTen ? (Math.round(value * 10) / 100).toFixed(1) : String(v);
  const footer = label ?? (isTen ? "التقييم" : "FIT");

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
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span
            className="font-bold leading-none tabular-nums text-[var(--color-ink)]"
            style={{ fontSize: Math.round(size * (isTen ? 0.3 : 0.26)) }}
          >
            {display}
          </span>
          {isTen && (
            <span
              dir="ltr"
              className="font-mono leading-none tabular-nums text-[var(--color-faint)]"
              style={{ fontSize: Math.round(size * 0.12), marginTop: Math.round(size * 0.04) }}
            >
              / 10
            </span>
          )}
        </span>
      </div>
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-[var(--color-faint)]">
        {footer}
      </span>
    </div>
  );
}
