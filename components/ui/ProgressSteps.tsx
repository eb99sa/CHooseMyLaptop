import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  current: number; // 1-based
  steps: string[];
}

export function ProgressSteps({ current, steps }: ProgressStepsProps) {
  return (
    <ol className="flex items-center gap-3 w-full">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors",
                  done && "bg-[var(--color-success)] text-white",
                  active && "bg-[var(--color-brand-600)] text-white",
                  !done && !active && "bg-slate-100 text-[var(--color-muted)]",
                )}
              >
                {done ? "✓" : n}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold whitespace-nowrap",
                  active ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="h-px flex-1 bg-[var(--color-line)]" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
