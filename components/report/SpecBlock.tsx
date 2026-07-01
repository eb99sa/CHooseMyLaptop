import type { SpecTarget } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SpecBlockProps {
  title: string;
  target: SpecTarget;
  tone?: "neutral" | "brand";
}

// Arabic labels for the SpecTarget fields. Keys stay English on purpose.
const SPEC_LABELS = {
  cpu_class: "المعالج",
  ram_gb: "الذاكرة (RAM)",
  storage: "التخزين",
  gpu: "كرت الشاشة",
  display: "الشاشة",
  battery: "البطارية",
  weight: "الوزن",
  os: "نظام التشغيل",
} as const;

const GPU_LABELS: Record<string, string> = {
  integrated: "مدمج (كافٍ للمهام العامة)",
  entry_dedicated: "منفصل مبتدئ",
  mid_dedicated: "منفصل متوسط",
  high_dedicated: "منفصل قوي",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] py-2 last:border-b-0">
      <span className="shrink-0 text-sm text-[var(--color-muted)]">{label}</span>
      <span
        className="text-end text-sm font-semibold text-[var(--color-ink)]"
        style={{ unicodeBidi: "plaintext" }}
      >
        {value}
      </span>
    </div>
  );
}

// Server, presentational. Renders a single SpecTarget as labeled Arabic rows.
export function SpecBlock({ title, target, tone = "neutral" }: SpecBlockProps) {
  const storage = `${target.storage_gb} GB ${target.storage_type === "either" ? "" : target.storage_type}`.trim();
  const display = `${target.display_inch_min}-${target.display_inch_max}" — ${target.display_quality}`;
  const gpu = GPU_LABELS[target.gpu] ?? target.gpu;

  return (
    <div
      className={cn(
        // Nested inside the report's outer Card — differentiated by fill depth,
        // NOT a competing border (EMO: only the outer card carries an edge).
        "h-full rounded-[var(--radius-md)] p-5",
        tone === "brand" ? "bg-[var(--color-surface-2)]" : "bg-[var(--color-surface-sunken)]",
      )}
    >
      <h4 className="mb-3 text-base font-bold text-[var(--color-ink)]">{title}</h4>
      <div className="space-y-0">
        <Row label={SPEC_LABELS.cpu_class} value={target.cpu_class} />
        <Row label={SPEC_LABELS.ram_gb} value={`${target.ram_gb} GB`} />
        <Row label={SPEC_LABELS.storage} value={storage} />
        <Row label={SPEC_LABELS.gpu} value={gpu} />
        <Row label={SPEC_LABELS.display} value={display} />
        <Row label={SPEC_LABELS.battery} value={`${target.battery_hours_min}+ ساعات`} />
        <Row label={SPEC_LABELS.weight} value={`حتى ${target.weight_kg_max} كجم`} />
        <Row label={SPEC_LABELS.os} value={target.os} />
      </div>
    </div>
  );
}
