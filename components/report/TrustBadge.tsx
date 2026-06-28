import { Icon, type IconName } from "@/components/ui/Icon";

interface TrustBadgeProps {
  icon: IconName;
  label: string;
  verified?: boolean; // optional neon "verified" dot
}

export function TrustBadge({ icon, label, verified = false }: TrustBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
      <span className="text-[var(--color-ink)]">
        <Icon name={icon} size={16} />
      </span>
      <span className="text-xs font-semibold text-[var(--color-ink)]">{label}</span>
      {verified && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--scene-green)] shadow-[var(--glow-soft)]"
          aria-hidden
        />
      )}
    </span>
  );
}
