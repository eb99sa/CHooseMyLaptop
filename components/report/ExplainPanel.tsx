import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface ExplainPanelProps {
  title: string;
  items: string[];
  tone?: "default" | "warn"; // default = why it fits; warn = where it may not
}

export function ExplainPanel({ title, items, tone = "default" }: ExplainPanelProps) {
  const warn = tone === "warn";
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5",
        warn ? "border-[rgba(184,121,27,0.30)]" : "border-[var(--color-line)]",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={warn ? "text-[var(--color-warning)]" : "text-[var(--color-ink)]"}>
          <Icon name={warn ? "alert" : "sparkle"} size={18} />
        </span>
        <h4 className="text-base font-bold text-[var(--color-ink)]">{title}</h4>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex gap-3 text-sm leading-relaxed text-[var(--color-muted)]"
          >
            <span
              className={cn(
                "mt-0.5 shrink-0",
                warn ? "text-[var(--color-warning)]" : "text-[var(--color-success)]",
              )}
            >
              <Icon name={warn ? "alert" : "check"} size={18} />
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
