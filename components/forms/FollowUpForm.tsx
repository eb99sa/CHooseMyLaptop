"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardMuted } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OptionChip } from "@/components/ui/OptionChip";
import { QuestionCard } from "@/components/ui/QuestionCard";
import { NarrowingLoader } from "@/components/ui/NarrowingLoader";
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
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ids for the question heading and the submit-error alert. The heading
  // id also labels the current question's option group / free-text input.
  const baseId = useId();
  const headingId = `${baseId}-q`;
  const errorId = `${baseId}-err`;

  // Focus target for the submit-error alert.
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  // Skip the focus move on the very first render so we don't steal focus on
  // page load; only move focus when the step actually changes (goNext/goBack).
  const mountedRef = useRef(false);

  // On step change, move focus to the new question heading so screen readers
  // announce it and keyboard users land in the right place.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    document.getElementById(headingId)?.focus();
  }, [step, headingId]);

  // On a submit failure, move focus to the alert so it is announced.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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

  async function submit() {
    if (pending) return;
    setError(null);
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

  if (pending) return <BuildingReport />;

  // No follow-ups: go straight to building the recommendation.
  if (questions.length === 0) {
    return (
      <Card className="animate-fadeup flex flex-col items-start gap-5">
        <CardMuted>لا توجد أسئلة إضافية لحالتك. اضغط لإنشاء توصيتك.</CardMuted>
        <Button
          variant="primary"
          onClick={submit}
          iconEnd={<Icon name="arrow-left" size={16} />}
        >
          إنشاء التوصية
        </Button>
      </Card>
    );
  }

  const q = questions[step];
  const isLast = step === questions.length - 1;
  // single-select / yes-no are required to advance; text/number/multi optional.
  const required = q.question_type === "single_select" || q.question_type === "boolean";
  const v = answers[q.question_key];
  const answered =
    q.question_type === "multi_select"
      ? Array.isArray(v) && v.length > 0
      : typeof v === "string" && v !== "";

  function goNext() {
    if (isLast) submit();
    else setStep((s) => Math.min(questions.length - 1, s + 1));
  }
  function goBack() {
    if (step === 0) router.push("/sessions/new");
    else setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="animate-fadeup space-y-4">
      <QuestionCard
        key={q.question_key}
        step={step + 1}
        total={questions.length}
        question={q.question_text}
        headingId={headingId}
        hint={q.reason}
        onBack={goBack}
        onNext={goNext}
        nextLabel={isLast ? "إنشاء التوصية" : "التالي"}
        nextDisabled={required && !answered}
        nextDescribedBy={error ? errorId : undefined}
      >
        <QuestionInput
          question={q}
          value={v}
          labelledBy={headingId}
          onSingle={(val) => setSingle(q.question_key, val)}
          onToggle={(val) => toggleMulti(q.question_key, val)}
        />
      </QuestionCard>

      {error && (
        <p
          id={errorId}
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[var(--radius-card)] border border-[var(--color-danger)] bg-[var(--tint-danger)] px-4 py-3 text-sm font-semibold text-[var(--color-danger)] focus:outline-none"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-question renderer — option chips for choices, inputs for text/number.
// ---------------------------------------------------------------------------
interface QuestionInputProps {
  question: AIQuestion;
  value: string | string[] | undefined;
  /** id of the question heading; labels the group / input. */
  labelledBy: string;
  onSingle: (value: string) => void;
  onToggle: (value: string) => void;
}

function QuestionInput({ question, value, labelledBy, onSingle, onToggle }: QuestionInputProps) {
  const { question_type, question_key, options } = question;

  if (question_type === "boolean") {
    return (
      <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-3">
        {YES_NO.map((opt) => (
          <OptionChip
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
      <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-3">
        {(options ?? []).map((opt) => (
          <OptionChip
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
      <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-3">
        {(options ?? []).map((opt) => (
          <OptionChip
            key={opt.value}
            label={opt.label}
            multi
            selected={selected.includes(opt.value)}
            onClick={() => onToggle(opt.value)}
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
        aria-labelledby={labelledBy}
        id={question_key}
      />
    );
  }

  return (
    <input
      type="text"
      className="input"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onSingle(e.target.value)}
      aria-labelledby={labelledBy}
      id={question_key}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading state while the report is being built (can take several seconds).
// ---------------------------------------------------------------------------
function BuildingReport() {
  return (
    <Card className="flex animate-fadeup flex-col items-center gap-5 py-12 text-center">
      <NarrowingLoader label="نضيّق الخيارات ونجهّز توصيتك…" total={120} />
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        قد تاخذ الخطوة كم ثانية. لا تسكّر الصفحة.
      </p>
    </Card>
  );
}
