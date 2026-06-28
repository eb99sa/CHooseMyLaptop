"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardMuted } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UI } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AIQuestion, UserAnswer } from "@/lib/types";

interface FollowUpFormProps {
  sessionId: string;
  questions: AIQuestion[];
}

// Per-question state: a single string (boolean/single/text/number) or a
// string[] for multi_select.
type AnswerState = Record<string, string | string[]>;

const YES_NO: { value: string; label: string }[] = [
  { value: "true", label: "نعم" },
  { value: "false", label: "لا" },
];

export function FollowUpForm({ sessionId, questions }: FollowUpFormProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerState>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setSingle(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMulti(key: string, value: string) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }

  function buildPayload(): UserAnswer[] {
    return questions.map((q) => {
      const raw = answers[q.question_key];
      const answer_value =
        q.question_type === "multi_select"
          ? // The API normalizes arrays (JSON-encodes them) on its side.
            ((Array.isArray(raw) ? raw : []) as unknown as string)
          : typeof raw === "string"
            ? raw
            : "";
      return {
        question_key: q.question_key,
        question_text: q.question_text,
        answer_value,
        answer_type: q.question_type,
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);

    // Require the quick choice questions (single-select / yes-no) to be answered.
    // Text, number, and multi-select are left optional.
    const unanswered = questions.filter((q) => {
      if (q.question_type === "single_select" || q.question_type === "boolean") {
        const v = answers[q.question_key];
        return typeof v !== "string" || v === "";
      }
      return false;
    });
    if (unanswered.length > 0) {
      setError("الرجاء الإجابة على الأسئلة المطلوبة قبل المتابعة.");
      return;
    }

    setPending(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: buildPayload() }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!res.ok || !data?.ok) {
        setError("تعذّر إنشاء التقرير. تأكّد من اتصالك بالإنترنت وحاول مرة أخرى.");
        setPending(false);
        return;
      }

      router.push(`/sessions/${sessionId}/report`);
    } catch {
      setError("حدث خطأ غير متوقع. حاول مرة أخرى.");
      setPending(false);
    }
  }

  if (pending) {
    return <BuildingReport />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {questions.length === 0 ? (
        <Card className="animate-fadeup">
          <CardMuted>
            لا توجد أسئلة إضافية لحالتك. اضغط على الزر بالأسفل لإنشاء توصيتك.
          </CardMuted>
        </Card>
      ) : (
        questions.map((q, i) => (
          <Card key={q.question_key} className="animate-fadeup">
            <fieldset>
              <legend className="text-base font-bold text-[var(--color-ink)]">
                {i + 1}. {q.question_text}
              </legend>
              {q.reason && (
                <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                  {q.reason}
                </p>
              )}

              <div className="mt-4">
                <QuestionInput
                  question={q}
                  value={answers[q.question_key]}
                  onSingle={(v) => setSingle(q.question_key, v)}
                  onToggle={(v) => toggleMulti(q.question_key, v)}
                />
              </div>
            </fieldset>
          </Card>
        ))
      )}

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-[var(--color-danger)]/30 bg-[rgba(255,111,111,0.1)] px-4 py-3 text-sm font-semibold text-[var(--color-danger)]"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Link href="/sessions/new" className="btn btn-ghost text-sm">
          {UI.back}
        </Link>
        <Button type="submit" variant="primary">
          إنشاء التوصية
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Per-question renderer
// ---------------------------------------------------------------------------
interface QuestionInputProps {
  question: AIQuestion;
  value: string | string[] | undefined;
  onSingle: (value: string) => void;
  onToggle: (value: string) => void;
}

function QuestionInput({ question, value, onSingle, onToggle }: QuestionInputProps) {
  const { question_type, question_key, options } = question;

  if (question_type === "boolean") {
    return (
      <div className="flex flex-wrap gap-2">
        {YES_NO.map((opt) => (
          <OptionButton
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onClick={() => onSingle(opt.value)}
          />
        ))}
      </div>
    );
  }

  if (question_type === "single_select") {
    return (
      <div className="flex flex-wrap gap-2">
        {(options ?? []).map((opt) => (
          <OptionButton
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onClick={() => onSingle(opt.value)}
          />
        ))}
      </div>
    );
  }

  if (question_type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {(options ?? []).map((opt) => (
          <OptionButton
            key={opt.value}
            label={opt.label}
            selected={selected.includes(opt.value)}
            onClick={() => onToggle(opt.value)}
            multi
          />
        ))}
      </div>
    );
  }

  if (question_type === "number") {
    return (
      <input
        type="number"
        inputMode="numeric"
        className="input"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onSingle(e.target.value)}
        aria-label={question.question_text}
        id={question_key}
      />
    );
  }

  // text (and any unknown type) -> free text
  return (
    <input
      type="text"
      className="input"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onSingle(e.target.value)}
      aria-label={question.question_text}
      id={question_key}
    />
  );
}

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  multi?: boolean;
}

function OptionButton({ label, selected, onClick, multi }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
        selected
          ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-[var(--color-on-brand)] shadow-[0_0_16px_rgba(53,230,162,0.3)]"
          : "border-[var(--color-line-strong)] bg-[rgba(150,200,178,0.04)] text-[var(--color-ink)] hover:border-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]",
      )}
    >
      {multi && (
        <span
          aria-hidden
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border text-[10px] leading-none",
            selected
              ? "border-[var(--color-on-brand)] bg-[var(--color-on-brand)]/20 text-[var(--color-on-brand)]"
              : "border-[var(--color-line)]",
          )}
        >
          {selected ? "✓" : ""}
        </span>
      )}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading state while the report is being built (can take several seconds).
// ---------------------------------------------------------------------------
function BuildingReport() {
  return (
    <Card className="flex flex-col items-center gap-5 py-12 text-center animate-fadeup">
      <span
        aria-hidden
        className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-brand-50)] border-t-[var(--color-brand-600)]"
      />
      <div className="space-y-1">
        <p className="text-base font-bold text-[var(--color-ink)]">{UI.buildingReport}</p>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          قد تستغرق هذه الخطوة بضع ثوانٍ. من فضلك لا تغلق الصفحة.
        </p>
      </div>
    </Card>
  );
}
