"use client";

import { useId, useState } from "react";
import type { SpecMeter } from "@/lib/specView";
import { SpecBar } from "@/components/report/SpecBar";
import { Icon } from "@/components/ui/Icon";

/**
 * Client flip for a laptop card's spec meters. The card front shows only a /10
 * rating; the six benefit bars (specMeters) live one tap away — same affordance
 * as NeedsFlipCard. SpecReveal owns the client state so LaptopCard stays a
 * server component (SpecBar is server-safe and renders fine inside).
 */
export function SpecReveal({ meters }: { meters: SpecMeter[] }) {
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
        {open ? "إخفاء المواصفات" : "عرض المواصفات"}
      </button>

      {open && (
        <div id={panelId} className="grid grid-cols-1 gap-x-5 gap-y-3 min-[400px]:grid-cols-2">
          {meters.map((m) => (
            <SpecBar key={m.key} label={m.label} level={m.level} value={m.value} />
          ))}
        </div>
      )}
    </div>
  );
}
