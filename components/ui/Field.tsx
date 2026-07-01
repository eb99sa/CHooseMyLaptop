import { useId, type ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  /**
   * Stable id placed on the <label>. Groups (radiogroup/group) can point at it
   * via aria-labelledby. Falls back to `${htmlFor}-label` or a generated id.
   */
  labelId?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, htmlFor, labelId, required, children }: FieldProps) {
  const generatedId = useId();
  const resolvedLabelId = labelId ?? (htmlFor ? `${htmlFor}-label` : generatedId);
  return (
    <div className="space-y-2">
      <label
        id={resolvedLabelId}
        htmlFor={htmlFor}
        className="block text-sm font-bold text-[var(--color-ink)]"
      >
        {label}
        {required && <span className="text-[var(--color-danger)]"> *</span>}
      </label>
      {hint && <p className="text-xs text-[var(--color-muted)] leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}
