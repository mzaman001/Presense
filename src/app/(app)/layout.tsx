import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Sidebar, BottomNav } from "@/components/layout/Navigation";
import { CaptureModal } from "@/components/features/CaptureModal";
import { PomodoroTimer } from "@/components/features/PomodoroTimer";
import { FAB } from "@/components/features/FAB";
import { AppContentWrapper } from "@/components/layout/AppContentWrapper";
import { SettingsModal } from "@/components/features/SettingsModal";
import { SearchModal } from "@/components/features/SearchModal";
import { AppInitializer } from "@/components/layout/AppInitializer";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

// App layout — shown for all protected (app) pages
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if onboarding is complete by looking for user_settings
  const { data: settings } = await supabase
    .from("user_settings")
    .select("display_name, onboarding_complete")
    .eq("user_id", user.id)
    .single();

  if (!settings || settings.onboarding_complete === false) {
    redirect("/onboarding");
  }
  return (
    <>
      <AppInitializer />
      <AmbientBackground />
      <Sidebar />
      <CaptureModal />
      <SearchModal />
      <SettingsModal />
      <PomodoroTimer />
      <FAB />
      <AppContentWrapper>
        {children}
      </AppContentWrapper>
      <BottomNav />
    </>
  );
}
