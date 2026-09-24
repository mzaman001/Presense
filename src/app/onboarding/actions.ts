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
