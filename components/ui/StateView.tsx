import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

interface StateViewProps {
  icon: IconName;
  title: string;
  body?: string;
  tone?: "default" | "danger";
  // Heading level: h1 for full-page states (error / not-found), h2/h3 when
  // rendered as a nested empty state below a page heading (e.g. report no-match).
  as?: "h1" | "h2" | "h3";
  children?: ReactNode; // action buttons
}

// Shared empty / error / not-found pattern: a machined mark, a title, an honest
// line of body, and one or two actions.
export function StateView({ icon, title, body, tone = "default", as: Heading = "h1", children }: StateViewProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div
        className="grid h-14 w-14 place-items-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface)]"
        style={{ color: tone === "danger" ? "var(--color-danger)" : "var(--color-muted)" }}
      >
        <Icon name={icon} size={26} />
      </div>
      <Heading className="text-xl font-bold text-[var(--color-ink)]">{title}</Heading>
      {body && (
        <div className="max-w-[360px] text-sm leading-relaxed text-[var(--color-muted)]">
          {body}
        </div>
      )}
      {children && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{children}</div>
      )}
    </div>
  );
}
