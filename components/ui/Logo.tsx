import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/i18n";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold text-lg", className)}>
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-brand-600)] bg-[var(--color-brand-50)] shadow-[0_0_14px_rgba(53,230,162,0.25)]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-brand-700)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="5" width="16" height="11" rx="1.5" />
          <path d="M2 20h20" />
        </svg>
      </span>
      <span>{APP_NAME}</span>
    </span>
  );
}
