"use server";

import { createClient } from "@/lib/supabase-server";
import { cleanOnboardingPatch } from "@/lib/first-run";

// Saves run server-side, as /login's do (PERF-10a), so supabase-js stays out
// of the onboarding bundle: it's the first page a new account loads.

export async function saveOnboardingSettings(
  patch: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = cleanOnboardingPatch(patch);
  if (!clean) return { ok: false, error: "That value isn't valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, error: "You're signed out. Please sign in again." };

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, ...clean }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const ONBOARDING_EVENTS = new Set(["onboarding_step", "onboarding_finished"]);

/**
 * Records an onboarding funnel event (public.product_events) for the
 * signed-in user: which step they reached, and whether they finished.
 * Best effort: never reports failure, so a lost event can't block setup.
 */
export async function trackOnboardingEvent(
  name: string,
  props: { step?: number; plan_now?: boolean } = {},
): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  if (!ONBOARDING_EVENTS.has(name)) return;
  const clean: { step?: number; plan_now?: boolean } = {};
  if (Number.isInteger(props.step) && props.step! >= 1 && props.step! <= 20)
    clean.step = props.step;
  if (typeof props.plan_now === "boolean") clean.plan_now = props.plan_now;
  try {
    const supabase = await createClient();
    await supabase.from("product_events").insert({ name, props: clean });
  } catch {
    // Analytics must never break onboarding.
  }
}
