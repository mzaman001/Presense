import { createClient } from "@/lib/supabase";
import type { Json } from "@/types/database.types";

/**
 * First-party usage events (public.product_events), so the signup →
 * onboarding → first plan → Start → came-back funnel can be read straight
 * from Supabase. Nothing goes to a third party, and no task text is sent:
 * props hold a step number or where a prompt was answered, never content.
 *
 * Fire and forget: a failed insert is dropped silently, never shown to the
 * user and never retried. It only records in production builds, so local
 * development against the shared project doesn't pollute the numbers.
 *
 * The onboarding page sends its events through a server action instead
 * (onboarding/actions.ts), so supabase-js stays out of that bundle.
 */
export type ProductEvent =
  | "app_open"
  | "onboarding_step"
  | "onboarding_finished"
  | "first_plan_finished"
  | "focus_started"
  | "reminders_offered"
  | "reminders_turned_on";

const APP_OPEN_KEY = "presense_last_open_day";

export function track(name: ProductEvent, props: Record<string, Json> = {}) {
  if (process.env.NODE_ENV !== "production") return;
  try {
    void createClient()
      .from("product_events")
      .insert({ name, props })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Analytics must never break the app.
  }
}

/** Today as a local calendar date, e.g. "2026-11-24". */
function localDay(now: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Records at most one app_open per device per local day: the "did they come
 * back?" signal. Returns whether it recorded one (for tests).
 */
export function trackAppOpen(now: Date = new Date()): boolean {
  const today = localDay(now);
  try {
    if (localStorage.getItem(APP_OPEN_KEY) === today) return false;
    localStorage.setItem(APP_OPEN_KEY, today);
  } catch {
    // No storage: still record, at worst once per load.
  }
  track("app_open");
  return true;
}
