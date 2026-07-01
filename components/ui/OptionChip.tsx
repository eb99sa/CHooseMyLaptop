import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface OptionChipProps {
  label: string;
  hint?: string;
  icon?: IconName;
  selected?: boolean;
  multi?: boolean; // checkbox (square) vs single-select (round) indicator
  onClick?: () => void;
  className?: string;
}

// An answer node in the advisor flow. Selected = softly extruded neumorphism
// with a faint scene-cyan halo + a carbon-filled check.
export function OptionChip({
  label,
  hint,
  icon,
  selected = false,
  multi = false,
  onClick,
  className,
}: OptionChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-3.5 text-start transition-all",
        selected
          ? "border-transparent shadow-[-6px_-6px_14px_rgba(255,255,255,0.92),7px_7px_18px_rgba(20,24,31,0.14),0_0_22px_rgba(53,224,216,0.30)]"
          : "border-[var(--color-line-strong)] bg-[var(--color-surface)] hover:-translate-y-px hover:border-[var(--color-ink)] hover:shadow-[var(--shadow-sm)]",
        className,
      )}
      style={selected ? { background: "linear-gradient(145deg, #ffffff, #eceef1)" } : undefined}
    >
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center border transition-all",
          multi ? "rounded-[var(--radius-xs)]" : "rounded-full",
          selected
            ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-on-brand)] shadow-[0_0_12px_rgba(53,224,216,0.45)]"
            : "border-[var(--color-line-strong)] bg-[var(--color-surface)] text-transparent",
        )}
      >
        {selected && <Icon name="check" size={13} />}
      </span>
      {icon && (
        <span className="grid shrink-0 place-items-center text-[var(--color-muted)]">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-semibold text-[var(--color-ink)]">{label}</span>
        {hint && <span className="text-xs leading-relaxed text-[var(--color-muted)]">{hint}</span>}
      </span>
    </button>
  );
}
