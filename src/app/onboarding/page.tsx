import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { normalizeColorMode } from "@/lib/theme";
import { CAPACITY_CHOICES, fromDbTime } from "@/lib/first-run";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select(
      "display_name, onboarding_complete, color_mode, nudge_time, shutdown_time, daily_capacity_minutes",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (settings?.onboarding_complete) {
    redirect("/");
  }

  return (
    <OnboardingWizard
      initial={{
        name:
          settings?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "",
        // A new account has no saved mode: start on System, the usual
        // default. Settings keeps its own fallback.
        colorMode: settings?.color_mode
          ? normalizeColorMode(settings.color_mode)
          : "system",
        morning: fromDbTime(settings?.nudge_time, "08:00"),
        evening: fromDbTime(settings?.shutdown_time, "18:00"),
        capacityMinutes: (CAPACITY_CHOICES as readonly number[]).includes(
          settings?.daily_capacity_minutes ?? 0,
        )
          ? (settings?.daily_capacity_minutes as number)
          : 240,
      }}
    />
  );
}
