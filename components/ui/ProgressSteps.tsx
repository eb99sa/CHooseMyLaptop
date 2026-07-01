import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

interface ProgressStepsProps {
  current: number; // 1-based
  steps: string[];
}

export function ProgressSteps({ current, steps }: ProgressStepsProps) {
  return (
    <ol className="flex w-full items-center gap-3" aria-label="خطوات">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-3"
            aria-current={active ? "step" : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-bold transition-all",
                  done && "bg-[var(--color-ink)] text-[var(--color-on-brand)]",
                  active &&
                    "bg-[var(--color-ink)] text-[var(--color-on-brand)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-ink)_7%,transparent)]",
                  !done &&
                    !active &&
                    "bg-[var(--color-surface-2)] text-[var(--color-faint)] ring-1 ring-[var(--color-line-strong)]",
                )}
              >
                {done ? <Icon name="check" size={16} /> : n}
                {active && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--scene-cyan)] shadow-[var(--glow-soft)]"
                  />
                )}
                {(active || done) && (
                  <span className="sr-only">{active ? "الخطوة الحالية" : "مكتملة"}</span>
                )}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-sm font-semibold",
                  active ? "inline" : "hidden min-[560px]:inline",
                  active
                    ? "text-[var(--color-ink)]"
                    : done
                      ? "text-[var(--color-muted)]"
                      : "text-[var(--color-faint)]",
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
