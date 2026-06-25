import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, htmlFor, required, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-[var(--color-ink)]">
        {label}
        {required && <span className="text-[var(--color-danger)]"> *</span>}
      </label>
      {hint && <p className="text-xs text-[var(--color-muted)] leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}
