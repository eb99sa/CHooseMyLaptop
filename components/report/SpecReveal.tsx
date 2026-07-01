"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * The "technical details" flip on a laptop card. The front shows plain aspect ratings;
 * the actual component names / GB / GPU model sit here, one tap away, for tech-savvy
 * users. Client island so LaptopCard can stay a server component.
 */
export function SpecReveal({ specs }: { specs: { label: string; value: string }[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-pressed={open}
        aria-expanded={open}
        aria-controls={panelId}
        className="btn btn-ghost w-full justify-center text-xs"
      >
        <Icon name="refresh" size={14} />
        {open ? "إخفاء التفاصيل التقنية" : "التفاصيل التقنية"}
      </button>

      {open && (
        <dl id={panelId} className="grid grid-cols-1 gap-x-6 min-[400px]:grid-cols-2">
          {specs.map((sp, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-2 border-b border-[var(--color-line)] py-1.5 text-xs"
            >
              <dt className="shrink-0 text-[var(--color-muted)]">{sp.label}</dt>
              <dd
                className="truncate text-end font-semibold text-[var(--color-ink)]"
                dir="auto"
                style={{ unicodeBidi: "plaintext" }}
                title={sp.value}
              >
                {sp.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
