import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if they are already an active user (has items)
  const { count } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count && count > 0) {
    redirect("/");
  }

  // Fetch initial settings
  const { data: settings } = await supabase
    .from("user_settings")
    .select("display_name, timezone")
    .eq("user_id", user.id)
    .single();

  return <OnboardingClient initialName={settings?.display_name || ""} initialTimezone={settings?.timezone || "UTC"} />;
}
