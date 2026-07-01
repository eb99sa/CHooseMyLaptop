"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { NarrowingLoader } from "@/components/ui/NarrowingLoader";
import { OptionChip } from "@/components/ui/OptionChip";
import type { IconName } from "@/components/ui/Icon";
import type {
  BasicNeeds,
  ConditionPref,
  Importance,
  ScreenSizePref,
  UseCase,
  Urgency,
} from "@/lib/types";
import {
  CONDITION_LABELS,
  IMPORTANCE_LABELS,
  SCREEN_SIZE_LABELS,
  UI,
  URGENCY_LABELS,
  USE_CASE_DESCRIPTIONS,
  USE_CASE_LABELS,
  USE_CASE_ORDER,
} from "@/lib/i18n";

// Page 1 form — collects the full BasicNeeds shape and creates a session,
// then routes to the AI follow-up questions step. Anonymous: no location
// prompt (currency is chosen alongside the budget); location stays "skipped".

interface FormErrors {
  budget?: string;
  use_case?: string;
  submit?: string;
}

// A reusable group of option chips for enum choices (single-select).
// The wrapper is a radiogroup labelled by the owning Field's label id so
// assistive tech announces the question when focus enters the options.
function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  labelId,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  labelId: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {options.map((opt) => (
        <OptionChip
          key={opt.value}
          label={opt.label}
          selected={opt.value === value}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  );
}

function toOptions<T extends string>(record: Record<T, string>): Array<{ value: T; label: string }> {
  return (Object.keys(record) as T[]).map((value) => ({ value, label: record[value] }));
}

// Best-fit line icons for each use case (decorative leading glyphs).
const USE_CASE_ICONS: Record<UseCase, IconName> = {
  teaching: "screen",
  university: "graduation",
  office: "briefcase",
  programming: "cpu",
  design: "sparkle",
  engineering: "gauge",
  gaming: "gpu",
  video_editing: "screen",
  business: "wallet",
  family: "laptop",
};

export function BasicNeedsForm() {
  const router = useRouter();

  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [currency, setCurrency] = useState<string>("KWD");
  const [primaryUseCase, setPrimaryUseCase] = useState<UseCase | null>(null);
  const [portability, setPortability] = useState<Importance>("somewhat");
  const [batteryImportance, setBatteryImportance] = useState<Importance>("somewhat");
  const [screenSizePref, setScreenSizePref] = useState<ScreenSizePref>("no_pref");
  const [needsArabicKeyboard, setNeedsArabicKeyboard] = useState<boolean>(false);
  const [conditionPref, setConditionPref] = useState<ConditionPref>("either");
  const [urgency, setUrgency] = useState<Urgency>("soon");
  const [preferredStores, setPreferredStores] = useState<string>("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);

  function validate(): { ok: boolean; min: number; max: number } {
    const next: FormErrors = {};
    const min = Number(budgetMin);
    const max = Number(budgetMax);

    if (!budgetMax || Number.isNaN(max) || max <= 0) {
      next.budget = "أدخل ميزانية قصوى صحيحة أكبر من صفر.";
    } else if (budgetMin && !Number.isNaN(min) && min > max) {
      next.budget = "الحد الأدنى للميزانية يجب أن يكون أقل من الحد الأقصى.";
    }

    if (!primaryUseCase) {
      next.use_case = "اختر استخدامك الأساسي للمتابعة.";
    }

    setErrors(next);
    return { ok: Object.keys(next).length === 0, min, max };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    const { ok, min, max } = validate();
    if (!ok || !primaryUseCase) return;

    const payload: BasicNeeds = {
      budget_min: budgetMin ? min : 0,
      budget_max: max,
      currency: currency.trim() || "KWD",
      country: "",
      city_or_area: "",
      location_source: "skipped",
      primary_use_case: primaryUseCase,
      portability,
      battery_importance: batteryImportance,
      screen_size_pref: screenSizePref,
      needs_arabic_keyboard: needsArabicKeyboard,
      condition_pref: conditionPref,
      preferred_stores: preferredStores.trim() || undefined,
      urgency,
    };

    setPending(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 503) {
        setPending(false);
        setErrors((prev) => ({
          ...prev,
          submit: "الخدمة غير مهيأة بعد. الرجاء المحاولة لاحقاً.",
        }));
        return;
      }

      if (!res.ok) {
        throw new Error("request_failed");
      }

      const data: { session_id?: string } = await res.json();
      if (!data.session_id) {
        throw new Error("no_session");
      }

      router.push(`/sessions/${data.session_id}/questions`);
    } catch {
      setPending(false);
      setErrors((prev) => ({
        ...prev,
        submit: "حدث خطأ أثناء إنشاء التوصية. تأكّد من اتصالك وحاول مرة أخرى.",
      }));
    }
  }

  if (pending) {
    return (
      <Card className="p-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <NarrowingLoader showCount={false} label={UI.generatingQuestions} />
          <p className="text-sm text-[var(--color-muted)]">
            قد تاخذ الخطوة كم ثانية. لا تسكّر الصفحة.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Use case — required, selectable cards */}
      <Card className="p-6">
        <Field
          label="ما هو استخدامك الأساسي للجهاز؟"
          hint="اختر الاستخدام الأقرب لك — يحدّد المواصفات المناسبة لميزانيتك."
          labelId="use-case-label"
          required
        >
          <div
            role="radiogroup"
            aria-labelledby="use-case-label"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {USE_CASE_ORDER.map((uc) => (
              <OptionChip
                key={uc}
                icon={USE_CASE_ICONS[uc]}
                label={USE_CASE_LABELS[uc]}
                hint={USE_CASE_DESCRIPTIONS[uc]}
                selected={primaryUseCase === uc}
                onClick={() => {
                  setPrimaryUseCase(uc);
                  setErrors((prev) => ({ ...prev, use_case: undefined }));
                }}
              />
            ))}
          </div>
          {errors.use_case && (
            <p className="mt-2 text-sm font-semibold text-[var(--color-danger)]">
              {errors.use_case}
            </p>
          )}
        </Field>
      </Card>

      {/* Budget + currency */}
      <Card className="space-y-5 p-6">
        <Field
          label="الميزانية"
          hint="أدخل الحد الأقصى الذي ترغب بإنفاقه. الحد الأدنى اختياري."
          required
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className="input"
              placeholder="الحد الأدنى (اختياري)"
              aria-label="الحد الأدنى للميزانية"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className="input"
              placeholder="الحد الأقصى"
              aria-label="الحد الأقصى للميزانية"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
            />
            <select
              className="input"
              aria-label="العملة"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="KWD">دينار كويتي (KWD)</option>
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="AED">درهم إماراتي (AED)</option>
              <option value="QAR">ريال قطري (QAR)</option>
              <option value="BHD">دينار بحريني (BHD)</option>
              <option value="OMR">ريال عماني (OMR)</option>
              <option value="USD">دولار أمريكي (USD)</option>
            </select>
          </div>
          {errors.budget && (
            <p className="mt-2 text-sm font-semibold text-[var(--color-danger)]">{errors.budget}</p>
          )}
        </Field>
      </Card>

      {/* Preferences */}
      <Card className="space-y-6 p-6">
        <Field
          label="أهمية خفة الوزن وسهولة الحمل"
          hint="هل تحمل الجهاز معك كثيراً؟"
          labelId="portability-label"
        >
          <ChoiceGroup<Importance>
            options={toOptions(IMPORTANCE_LABELS)}
            value={portability}
            onChange={setPortability}
            labelId="portability-label"
          />
        </Field>

        <Field
          label="أهمية عمر البطارية"
          hint="هل تستخدم الجهاز بعيداً عن الشاحن غالباً؟"
          labelId="battery-label"
        >
          <ChoiceGroup<Importance>
            options={toOptions(IMPORTANCE_LABELS)}
            value={batteryImportance}
            onChange={setBatteryImportance}
            labelId="battery-label"
          />
        </Field>

        <Field label="حجم الشاشة المفضّل" labelId="screen-size-label">
          <ChoiceGroup<ScreenSizePref>
            options={toOptions(SCREEN_SIZE_LABELS)}
            value={screenSizePref}
            onChange={setScreenSizePref}
            labelId="screen-size-label"
          />
        </Field>

        <Field label="حالة الجهاز" labelId="condition-label">
          <ChoiceGroup<ConditionPref>
            options={toOptions(CONDITION_LABELS)}
            value={conditionPref}
            onChange={setConditionPref}
            labelId="condition-label"
          />
        </Field>

        <Field label="مدى الاستعجال" labelId="urgency-label">
          <ChoiceGroup<Urgency>
            options={toOptions(URGENCY_LABELS)}
            value={urgency}
            onChange={setUrgency}
            labelId="urgency-label"
          />
        </Field>

        <Field label="لوحة المفاتيح" labelId="keyboard-label">
          <div role="group" aria-labelledby="keyboard-label">
            <OptionChip
              multi
              label="أحتاج لوحة مفاتيح عربية مطبوعة"
              selected={needsArabicKeyboard}
              onClick={() => setNeedsArabicKeyboard((b) => !b)}
            />
          </div>
        </Field>

        <Field
          label="متاجر مفضّلة (اختياري)"
          hint="إن كنت تفضّل الشراء من متاجر معينة، اكتب أسماءها مفصولة بفاصلة."
          htmlFor="stores"
        >
          <input
            id="stores"
            type="text"
            className="input"
            placeholder="مثال: إكسايت، بست، X-cite"
            value={preferredStores}
            onChange={(e) => setPreferredStores(e.target.value)}
          />
        </Field>
      </Card>

      {errors.submit && (
        <p className="text-sm font-semibold text-[var(--color-danger)]" role="alert">
          {errors.submit}
        </p>
      )}

      <div className="flex justify-start">
        <Button type="submit" variant="primary" disabled={pending}>
          {UI.next}
        </Button>
      </div>
    </form>
  );
}
