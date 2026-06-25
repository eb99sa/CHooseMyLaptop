import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/i18n";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold text-lg", className)}>
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] text-white text-base"
      >
        💻
      </span>
      <span>{APP_NAME}</span>
    </span>
  );
}
