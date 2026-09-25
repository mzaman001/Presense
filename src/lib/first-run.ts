/**
 * First run: onboarding hands a new user straight into their first Plan my
 * day. The flag lives in localStorage so a refresh mid-plan resumes it.
 * Storage can be unavailable (private mode, blocked site data); every
 * accessor degrades to "not set" rather than throwing.
 */

const FIRST_RUN_KEY = "presense_first_run";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the first run simply isn't special.
  }
}

/** Onboarding finished with "Plan my day": open the first plan on Home. */
export function startFirstRun() {
  write(FIRST_RUN_KEY, "1");
}

export function isFirstRun(): boolean {
  return read(FIRST_RUN_KEY) === "1";
}

/** The first plan was finished, skipped or closed: it's an ordinary ritual now. */
export function endFirstRun() {
  write(FIRST_RUN_KEY, null);
}

// ─── Onboarding wizard helpers ────────────────────────────────────────────────

const STEP_KEY = "presense_onboarding_step";

/** The wizard step to resume on after a refresh (1 when none is saved). */
export function loadOnboardingStep(max: number): number {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STEP_KEY);
  } catch {
    return 1;
  }
  const step = Number(raw);
  return Number.isInteger(step) && step >= 1 && step <= max ? step : 1;
}

export function saveOnboardingStep(step: number | null) {
  try {
    if (step === null) sessionStorage.removeItem(STEP_KEY);
    else sessionStorage.setItem(STEP_KEY, String(step));
  } catch {
    // Storage unavailable: a refresh starts the wizard from the top.
  }
}

/** "08:00" (an <input type="time"> value) → "08:00:00" for a Postgres time. */
export function toDbTime(value: string): string {
  const [h = "0", m = "0"] = value.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`;
}

/** "08:00:00" (Postgres time) → "08:00", or the fallback when unset. */
export function fromDbTime(value: string | null | undefined, fallback: string) {
  return value && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : fallback;
}

/** "18:00" → "6:00 PM" in the viewer's locale. */
export function formatClock(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Onboarding settings, validated for the server action ────────────────────

export const CAPACITY_CHOICES = [120, 240, 360, 480] as const;

export interface OnboardingPatch {
  display_name?: string;
  color_mode?: "light" | "dark" | "system";
  nudge_time?: string;
  shutdown_time?: string;
  daily_capacity_minutes?: number;
  timezone?: string;
  onboarding_complete?: true;
}

const DB_TIME = /^([01]\d|2[0-3]):[0-5]\d:00$/;

/**
 * Keeps only the fields onboarding may set, each checked. Returns null when
 * anything is invalid, so a bad value is refused rather than half-saved.
 */
export function cleanOnboardingPatch(input: unknown): OnboardingPatch | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out: OnboardingPatch = {};
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case "display_name": {
        const name = typeof value === "string" ? value.trim() : "";
        if (!name || name.length > 60) return null;
        out.display_name = name;
        break;
      }
      case "color_mode":
        if (value !== "light" && value !== "dark" && value !== "system")
          return null;
        out.color_mode = value;
        break;
      case "nudge_time":
      case "shutdown_time":
        if (typeof value !== "string" || !DB_TIME.test(value)) return null;
        out[key] = value;
        break;
      case "daily_capacity_minutes":
        if (!CAPACITY_CHOICES.includes(value as 120)) return null;
        out.daily_capacity_minutes = value as number;
        break;
      case "timezone":
        if (typeof value !== "string" || !value || value.length > 64)
          return null;
        out.timezone = value;
        break;
      case "onboarding_complete":
        if (value !== true) return null;
        out.onboarding_complete = true;
        break;
      default:
        return null;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
