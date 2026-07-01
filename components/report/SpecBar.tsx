import { cn } from "@/lib/utils";

interface SpecBarProps {
  label: string; // what the spec means for the user (e.g. «الألعاب والرسوميات»)
  level: number; // 0..100
  note?: string; // plain rating word (e.g. «ممتاز») — NOT tech jargon
  className?: string;
}

// An aspect shown as what it MEANS + a strength bar + a plain rating word. No component
// names, no GB, no integrated-vs-dedicated — that lives behind the flip.
export function SpecBar({ label, level, note, className }: SpecBarProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--color-ink)]">{label}</span>
        {note && <span className="text-[var(--color-muted)]">{note}</span>}
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
