"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button-variants";
import { BrandMark } from "@/components/ui/BrandMark";
import { applyDocumentTheme, type ColorMode } from "@/lib/theme";
import {
  CAPACITY_CHOICES,
  endFirstRun,
  formatClock,
  loadOnboardingStep,
  saveOnboardingStep,
  startFirstRun,
  toDbTime,
  type OnboardingPatch,
} from "@/lib/first-run";
import { saveOnboardingSettings } from "./actions";

export interface OnboardingInitial {
  name: string;
  colorMode: ColorMode;
  morning: string;
  evening: string;
  capacityMinutes: number;
}

interface OnboardingWizardProps {
  initial: OnboardingInitial;
}

// 1 Welcome · 2 Name · 3 Look · 4 Morning planning · 5 Evening review ·
// 6 Daily capacity · 7 First plan
const LAST_STEP = 7;

const THEMES: { value: ColorMode; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Warm, like sunrise" },
  { value: "dark", label: "Dark", hint: "Soft, like sunset" },
  { value: "system", label: "System", hint: "Matches your device" },
];

const primary = buttonVariants({
  variant: "primary",
  className: "onb-cta w-full sm:w-auto sm:min-w-44",
});
const ghost = buttonVariants({ variant: "ghost" });

/** Show a colour mode on the page now, and on the next load before hydration. */
function applyMode(mode: ColorMode) {
  const html = document.documentElement;
  applyDocumentTheme(
    "warm",
    mode,
    html.classList.contains("reduce-motion"),
    html.getAttribute("data-density"),
  );
  try {
    localStorage.setItem("presense_color_mode", mode);
  } catch {
    // Storage unavailable: the choice is still saved to the account.
  }
}

export function OnboardingWizard({ initial }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(initial.name);
  const [colorMode, setColorMode] = useState<ColorMode>(initial.colorMode);
  const [morning, setMorning] = useState(initial.morning);
  const [evening, setEvening] = useState(initial.evening);
  const [capacity, setCapacity] = useState(initial.capacityMinutes);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  // Resume where a refresh left off.
  useEffect(() => {
    const saved = loadOnboardingStep(LAST_STEP);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved > 1) setStep(saved);
  }, []);

  // Each screen is one question: move focus to it so keyboard and screen
  // reader users land on the new content, not the old button.
  const mounted = useRef(false);
  useEffect(() => {
    // The look screen previews the selected mode on the page itself, so
    // what's ticked is what's shown.
    if (step === 3) applyMode(colorMode);
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const root = headingRef.current?.closest("form");
    const field = root?.querySelector<HTMLElement>("[data-autofocus]");
    (field ?? headingRef.current)?.focus();
    // Runs on step changes only; colorMode changes apply in onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const save = async (patch: OnboardingPatch) => {
    try {
      const result = await saveOnboardingSettings(patch);
      if (result.ok) return true;
      toast.error("Couldn't save that. Please try again.", {
        description: result.error,
      });
    } catch {
      toast.error("Couldn't save that. Please check your connection.");
    }
    return false;
  };

  const goTo = (next: number) => {
    setStep(next);
    saveOnboardingStep(next);
  };

  const patchForStep = (): OnboardingPatch | null => {
    switch (step) {
      case 2:
        return { display_name: name.trim() };
      case 3:
        return { color_mode: colorMode };
      case 4:
        return { nudge_time: toDbTime(morning) };
      case 5:
        return { shutdown_time: toDbTime(evening) };
      case 6:
        return { daily_capacity_minutes: capacity };
      default:
        return null;
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (step === 2 && !name.trim()) return;
    const patch = patchForStep();
    if (patch) {
      setSaving(true);
      const ok = await save(patch);
      setSaving(false);
      if (!ok) return;
    }
    goTo(Math.min(step + 1, LAST_STEP));
  };

  const finish = async (planNow: boolean) => {
    if (saving) return;
    setSaving(true);
    const ok = await save({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      onboarding_complete: true,
    });
    if (!ok) {
      setSaving(false);
      return;
    }
    saveOnboardingStep(null);
    if (planNow) startFirstRun();
    else endFirstRun();
    router.replace("/");
  };

  const spinner = (
    <Loader2 aria-hidden="true" className="size-5 animate-spin" />
  );
  const continueLabel = (
    <>
      Continue <ArrowRight aria-hidden="true" className="size-4" />
    </>
  );

  const heading = (text: React.ReactNode, sub?: React.ReactNode) => (
    <div className="space-y-3">
      <h1
        ref={headingRef}
        id="onb-heading"
        tabIndex={-1}
        className="onb-title outline-none"
      >
        {text}
      </h1>
      {sub && <p className="onb-sub">{sub}</p>}
    </div>
  );

  return (
    <div className="onb-shell">
      <header className="onb-header">
        <div className="flex h-10 items-center">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={saving}
              className={`${ghost} -ml-3 gap-1.5`}
            >
              <ArrowLeft aria-hidden="true" className="size-4" /> Back
            </button>
          ) : (
            <span className="flex items-center gap-2 text-[var(--accent)]">
              <BrandMark size={22} />
              <span className="font-heading text-[length:var(--text-title-sm)] font-semibold tracking-tight text-[var(--text-1)]">
                Presense
              </span>
            </span>
          )}
        </div>
        {step > 1 && (
          <div
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={LAST_STEP - 1}
            aria-valuenow={step - 1}
            aria-valuetext={`Step ${step - 1} of ${LAST_STEP - 1}`}
            className="onb-progress"
          >
            <span
              className="onb-progress-fill"
              style={{ transform: `scaleX(${(step - 1) / (LAST_STEP - 1)})` }}
            />
          </div>
        )}
      </header>

      <main className="onb-main">
        <form
          key={step}
          onSubmit={handleNext}
          aria-labelledby="onb-heading"
          className="onb-step"
          noValidate
        >
          {step === 1 && (
            <>
              {heading(
                <>
                  Clear your head.
                  <br />
                  <span className="text-[var(--accent-text)]">Get going.</span>
                </>,
                "Get everything out of your head, pick what fits today, and actually start.",
              )}
              <WelcomeLoop />
              <div className="onb-actions">
                <button type="submit" className={primary}>
                  Get started
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {heading("What should we call you?")}
              <input
                data-autofocus
                aria-labelledby="onb-heading"
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                maxLength={60}
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="onb-input"
              />
              <div className="onb-actions">
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className={primary}
                >
                  {saving ? spinner : continueLabel}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {heading(
                "How should Presense look?",
                "You can change this any time in Settings.",
              )}
              <div
                role="radiogroup"
                aria-labelledby="onb-heading"
                className="grid grid-cols-3 gap-2.5 sm:gap-3"
              >
                {THEMES.map((t) => (
                  <label key={t.value} className="onb-choice onb-theme">
                    <input
                      type="radio"
                      name="color_mode"
                      value={t.value}
                      checked={colorMode === t.value}
                      data-autofocus={colorMode === t.value || undefined}
                      onChange={() => {
                        setColorMode(t.value);
                        applyMode(t.value);
                      }}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`onb-swatch onb-swatch-${t.value}`}
                    >
                      <span className="onb-swatch-line" />
                      <span className="onb-swatch-line onb-swatch-line-short" />
                    </span>
                    <span className="text-[length:var(--text-body)] font-medium text-[var(--text-1)]">
                      {t.label}
                    </span>
                    <span className="hidden text-[length:var(--text-meta)] text-[var(--text-3)] sm:block">
                      {t.hint}
                    </span>
                  </label>
                ))}
              </div>
              <div className="onb-actions">
                <button type="submit" disabled={saving} className={primary}>
                  {saving ? spinner : continueLabel}
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              {heading(
                `When do you like to plan your day${firstName ? `, ${firstName}` : ""}?`,
                "Morning planning opens then. Two minutes to decide what today holds.",
              )}
              <TimeField value={morning} onChange={setMorning} />
              <div className="onb-actions">
                <button
                  type="submit"
                  disabled={saving || !morning}
                  className={primary}
                >
                  {saving ? spinner : continueLabel}
                </button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              {heading(
                "When do you usually call it a day?",
                "Your Evening review opens then, to close the day and rest.",
              )}
              <TimeField value={evening} onChange={setEvening} />
              <div className="onb-actions">
                <button
                  type="submit"
                  disabled={saving || !evening}
                  className={primary}
                >
                  {saving ? spinner : continueLabel}
                </button>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              {heading(
                "How much time do you usually have for your own things?",
                "Your daily capacity. Presense uses it to keep each day realistic.",
              )}
              <div
                role="radiogroup"
                aria-labelledby="onb-heading"
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
              >
                {CAPACITY_CHOICES.map((minutes) => (
                  <label key={minutes} className="onb-choice onb-chip">
                    <input
                      type="radio"
                      name="capacity"
                      value={minutes}
                      checked={capacity === minutes}
                      data-autofocus={capacity === minutes || undefined}
                      onChange={() => setCapacity(minutes)}
                      className="sr-only"
                    />
                    <span className="font-heading text-[length:var(--text-title-lg)] leading-none text-[var(--text-1)] tabular-nums">
                      {minutes / 60}h
                    </span>
                  </label>
                ))}
              </div>
              <div className="onb-actions">
                <button type="submit" disabled={saving} className={primary}>
                  {saving ? spinner : continueLabel}
                </button>
              </div>
            </>
          )}

          {step === 7 && (
            <>
              {heading(
                `You're ready${firstName ? `, ${firstName}` : ""}. Let's plan your first day.`,
                "Empty your head, pick what fits today, and start on one thing. It takes about two minutes.",
              )}
              <ul className="onb-summary">
                <li>
                  <span>Morning planning</span>
                  <span>{formatClock(morning)}</span>
                </li>
                <li>
                  <span>Evening review</span>
                  <span>{formatClock(evening)}</span>
                </li>
                <li>
                  <span>Daily capacity</span>
                  <span>{capacity / 60}h</span>
                </li>
              </ul>
              <div className="onb-actions">
                <button
                  type="button"
                  data-autofocus
                  disabled={saving}
                  onClick={() => void finish(true)}
                  className={primary}
                >
                  {saving ? spinner : "Plan my day"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void finish(false)}
                  className={`${ghost} w-full text-[var(--text-3)] sm:w-auto`}
                >
                  Skip for now
                </button>
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
}

function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="time"
      data-autofocus
      aria-labelledby="onb-heading"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="onb-input onb-time"
    />
  );
}

/**
 * The loop in one small, looping picture: a few thoughts land, the day fills
 * to what fits, and Start lights up. CSS only (no JS, no images); under
 * reduced motion it shows the finished picture.
 */
function WelcomeLoop() {
  const thoughts = ["Call the dentist", "Finish the report", "Buy a gift"];
  return (
    <div aria-hidden="true" className="onb-loop">
      <p className="onb-loop-label">What&apos;s on your mind?</p>
      <ul className="space-y-2">
        {thoughts.map((t, i) => (
          <li
            key={t}
            className="onb-loop-item"
            style={{ animationDelay: `${0.3 + i * 0.45}s` }}
          >
            <span className="onb-loop-dot" />
            {t}
          </li>
        ))}
      </ul>
      <div className="onb-loop-bar">
        <span className="onb-loop-bar-fill" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--text-meta)] text-[var(--text-3)]">
          Fits your day
        </span>
        <span className="onb-loop-start">Start</span>
      </div>
    </div>
  );
}
