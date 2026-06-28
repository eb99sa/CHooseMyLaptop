import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface SpecSignalProps {
  icon: IconName;
  code: string; // Latin mono micro-label (CPU / RAM / SSD …)
  value: string;
  lit?: boolean; // relevant to the user's answer → soft glow + neon tick
}

export function SpecSignal({ icon, code, value, lit = false }: SpecSignalProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3.5 py-3 transition-colors",
        lit
          ? "border-[var(--color-line-strong)] shadow-[var(--shadow-soft)]"
          : "border-[var(--color-line)]",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center",
          lit ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]",
        )}
      >
        <Icon name={icon} size={18} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
          {code}
        </span>
        <span
          className="truncate text-sm font-bold text-[var(--color-ink)]"
          style={{ unicodeBidi: "plaintext" }}
        >
          {value}
        </span>
      </div>
      <span
        className={cn(
          "ms-auto h-1.5 w-1.5 shrink-0 rounded-full",
          lit
            ? "bg-[var(--scene-cyan)] shadow-[var(--glow-soft)]"
            : "bg-[var(--color-line-strong)]",
        )}
        aria-hidden
      />
    </div>
  );
}
