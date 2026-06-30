"use client";

import { useState } from "react";
import type { SpecRecommendation } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { SpecBlock } from "@/components/report/SpecBlock";
import { ExplainPanel } from "@/components/report/ExplainPanel";
import { Icon } from "@/components/ui/Icon";
import { needHighlights } from "@/lib/specView";
import { UI } from "@/lib/i18n";

/**
 * One card for "what you need": a plain-language summary by default, with a button to flip to
 * the technical spec targets for tech-savvy users. Replaces the old separate need-summary +
 * recommended-specs sections (less clutter, detail one tap away).
 */
export function NeedsFlipCard({ spec }: { spec: SpecRecommendation }) {
  const [tech, setTech] = useState(false);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{tech ? UI.recommendedSpecs : UI.needSummary}</CardTitle>
        <button
          type="button"
          onClick={() => setTech((t) => !t)}
          aria-pressed={tech}
          className="btn btn-ghost shrink-0 text-xs"
        >
          <Icon name="refresh" size={14} />
          {tech ? "الملخّص" : "المواصفات التقنية"}
        </button>
      </div>

      {tech ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SpecBlock title={UI.minimumSpecs} target={spec.spec_range.minimum} />
            <SpecBlock title={UI.idealSpecs} target={spec.spec_range.ideal} tone="brand" />
          </div>
          {spec.spec_range.unnecessary.length > 0 && (
            <ExplainPanel title={UI.unnecessarySpecs} items={spec.spec_range.unnecessary} />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-[var(--color-ink)] sm:text-base">
            {spec.need_summary}
          </p>
          <ul className="flex flex-wrap gap-2">
            {needHighlights(spec.spec_range.ideal).map((h, i) => (
              <li
                key={i}
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]"
              >
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
