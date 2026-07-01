import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  step?: number;
  total?: number;
  eyebrow?: string;
  question: string;
  /** id placed on the question <h2> so groups/inputs can reference it via
   * aria-labelledby and callers can move focus to it on step change. */
  headingId?: string;
  hint?: string;
  children: ReactNode; // the options / input
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  /** id of an error/description element the Next button should reference. */
  nextDescribedBy?: string;
}

// The advisor panel — a machined "window" holding one question, its options,
// and back/next navigation. RTL: the primary action carries the forward (left)
// arrow; back carries the chevron pointing to the start (right).
export function QuestionCard({
  step,
  total,
  eyebrow = "ADVISOR",
  question,
  headingId,
  hint,
  children,
  onBack,
  onNext,
  nextLabel = "التالي",
  backLabel = "السابق",
  nextDisabled = false,
  nextDescribedBy,
}: QuestionCardProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-lift)]">
      <div
        className="flex h-[38px] items-center gap-2 border-b border-[var(--color-line)] px-4"
        style={{ background: "linear-gradient(180deg, var(--color-surface), var(--color-surface-2))" }}
      >
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <i key={i} className="block h-[9px] w-[9px] rounded-full bg-[var(--color-line-strong)]" />
          ))}
        </span>
        <span
          className="ms-auto font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-[var(--color-faint)]"
          dir="ltr"
        >
          {eyebrow}
        </span>
      </div>
      <div className="p-5 sm:p-8">
        {step != null && (
          <div
            className="mb-3.5 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-[var(--color-faint)]"
            dir="ltr"
          >
            Q{step}
            {total ? ` / ${total}` : ""}
          </div>
        )}
        <h2
          id={headingId}
          tabIndex={-1}
          className={cn(
            "text-2xl font-bold leading-snug text-[var(--color-ink)] [text-wrap:balance] focus:outline-none",
            hint ? "mb-2" : "mb-6",
          )}
        >
          {question}
        </h2>
        {hint && <p className="mb-6 text-sm leading-relaxed text-[var(--color-muted)]">{hint}</p>}
        <div className="flex flex-col gap-3">{children}</div>
        {(onBack || onNext) && (
          <div className="mt-7 flex items-center justify-between gap-3">
            {onBack ? (
              <Button
                variant="quiet"
                onClick={onBack}
                iconStart={<Icon name="chevron-right" size={16} />}
              >
                {backLabel}
              </Button>
            ) : (
              <span />
            )}
            {onNext && (
              <Button
                variant="primary"
                onClick={onNext}
                disabled={nextDisabled}
                aria-describedby={nextDescribedBy}
                iconEnd={<Icon name="arrow-left" size={16} />}
              >
                {nextLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
