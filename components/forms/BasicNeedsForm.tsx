"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { NarrowingLoader } from "@/components/ui/NarrowingLoader";
import { LocationPicker } from "@/components/location/LocationPicker";
import { cn } from "@/lib/utils";
import type {
  BasicNeeds,
  ConditionPref,
  Importance,
  LocationInfo,
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
// then routes to the AI follow-up questions step. Anonymous: location is
// chosen via LocationPicker, no country/city text inputs, no language field.

interface FormErrors {
  budget?: string;
  use_case?: string;
  submit?: string;
}

// A small reusable button-group for enum choices (radio-style segmented control).
function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              selected
                ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-brand-600)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function toOptions<T extends string>(record: Record<T, string>): Array<{ value: T; label: string }> {
  return (Object.keys(record) as T[]).map((value) => ({ value, label: record[value] }));
}

export function BasicNeedsForm() {
  const router = useRouter();

  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [currency, setCurrency] = useState<string>("KWD");
  // Location is managed by the LocationPicker. Default to "skipped" until the
  // user makes a choice; the currency stays in sync with whatever it supplies.
  const [location, setLocation] = useState<LocationInfo>({
    country: "",
    city_or_area: "",
    currency: "KWD",
    source: "skipped",
  });
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

  // When the picker supplies a currency, auto-update the selector. The user can
  // still override it afterwards via the <select>.
  function handleLocationChange(loc: LocationInfo) {
    setLocation(loc);
    if (loc.currency && loc.source !== "skipped") {
      setCurrency(loc.currency);
    }
  }

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
      country: location.country,
      city_or_area: location.city_or_area,
      location_source: location.source,
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
          required
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {USE_CASE_ORDER.map((uc) => {
              const selected = primaryUseCase === uc;
              return (
                <button
                  key={uc}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setPrimaryUseCase(uc);
                    setErrors((prev) => ({ ...prev, use_case: undefined }));
                  }}
                  className={cn(
                    "rounded-[var(--radius-card)] border p-4 text-start transition-colors",
                    selected
                      ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)] ring-1 ring-[var(--color-brand-600)]"
                      : "border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-brand-600)]",
                  )}
                >
                  <span
                    className={cn(
                      "block text-sm font-bold",
                      selected ? "text-[var(--color-brand-700)]" : "text-[var(--color-ink)]",
                    )}
                  >
                    {USE_CASE_LABELS[uc]}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--color-muted)]">
                    {USE_CASE_DESCRIPTIONS[uc]}
                  </span>
                </button>
              );
            })}
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

      {/* Location */}
      <LocationPicker value={location} onChange={handleLocationChange} />

      {/* Preferences */}
      <Card className="space-y-6 p-6">
        <Field label="أهمية خفة الوزن وسهولة الحمل" hint="هل تحمل الجهاز معك كثيراً؟">
          <ChoiceGroup<Importance>
            options={toOptions(IMPORTANCE_LABELS)}
            value={portability}
            onChange={setPortability}
          />
        </Field>

        <Field label="أهمية عمر البطارية" hint="هل تستخدم الجهاز بعيداً عن الشاحن غالباً؟">
          <ChoiceGroup<Importance>
            options={toOptions(IMPORTANCE_LABELS)}
            value={batteryImportance}
            onChange={setBatteryImportance}
          />
        </Field>

        <Field label="حجم الشاشة المفضّل">
          <ChoiceGroup<ScreenSizePref>
            options={toOptions(SCREEN_SIZE_LABELS)}
            value={screenSizePref}
            onChange={setScreenSizePref}
          />
        </Field>

        <Field label="حالة الجهاز">
          <ChoiceGroup<ConditionPref>
            options={toOptions(CONDITION_LABELS)}
            value={conditionPref}
            onChange={setConditionPref}
          />
        </Field>

        <Field label="مدى الاستعجال">
          <ChoiceGroup<Urgency>
            options={toOptions(URGENCY_LABELS)}
            value={urgency}
            onChange={setUrgency}
          />
        </Field>

        <Field label="لوحة المفاتيح">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--color-brand-600)]"
              checked={needsArabicKeyboard}
              onChange={(e) => setNeedsArabicKeyboard(e.target.checked)}
            />
            <span className="text-sm font-semibold text-[var(--color-ink)]">
              أحتاج لوحة مفاتيح عربية مطبوعة
            </span>
          </label>
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
