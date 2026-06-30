import { cn } from "@/lib/utils";

interface SpecBarProps {
  label: string; // what the spec means (e.g. «القوة والسرعة»)
  level: number; // 0..100
  value: string; // the tech detail, secondary
  className?: string;
}

// A spec shown as what it MEANS + a strength bar. The tech value sits muted at the end so
// tech-savvy users still see it, without the jargon dominating.
export function SpecBar({ label, level, value, className }: SpecBarProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--color-ink)]">{label}</span>
        <span className="truncate text-[var(--color-faint)]" style={{ unicodeBidi: "plaintext" }}>
          {value}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-line)]"
        role="meter"
        aria-valuenow={Math.round(level)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-[var(--color-ink)]"
          style={{ width: `${Math.max(4, Math.min(100, level))}%` }}
        />
      </div>
    </div>
  );
}
