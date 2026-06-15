import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Sidebar, BottomNav } from "@/components/layout/Navigation";
import { CaptureModal } from "@/components/features/CaptureModal";
import { FAB } from "@/components/features/FAB";
import { AppContentWrapper } from "@/components/layout/AppContentWrapper";
import { SettingsModal } from "@/components/features/SettingsModal";
import { SearchModal } from "@/components/features/SearchModal";

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
    .select("display_name")
    .eq("user_id", user.id)
    .single();

  if (!settings) {
    redirect("/onboarding");
  }
  return (
    <>
      <AmbientBackground />
      <Sidebar />
      <CaptureModal />
      <SearchModal />
      <SettingsModal />
      <FAB />
      <AppContentWrapper>
        {children}
      </AppContentWrapper>
      <BottomNav />
    </>
  );
}
