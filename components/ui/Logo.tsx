import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-lg font-extrabold text-[var(--color-ink)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-[var(--color-ink)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-3px_6px_rgba(80,86,94,0.35),var(--shadow-xs)]"
        style={{
          background:
            "conic-gradient(from 210deg, var(--chrome-1), var(--chrome-2), var(--chrome-hi), var(--chrome-3), var(--chrome-4), var(--chrome-2), var(--chrome-1))",
        }}
      >
        <Icon name="laptop" size={18} />
      </span>
      <span>{APP_NAME}</span>
    </span>
  );
}
