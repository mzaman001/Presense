import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch initial settings if any
  const { data: settings } = await supabase
    .from("user_settings")
    .select("display_name, onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settings?.onboarding_complete) {
    redirect("/");
  }

  return <OnboardingWizard initialName={settings?.display_name || user.user_metadata?.full_name || ""} />;
}
