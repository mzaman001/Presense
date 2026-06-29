import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Sidebar, BottomNav } from "@/components/layout/Navigation";
import { FAB } from "@/components/features/FAB";
import { AppContentWrapper } from "@/components/layout/AppContentWrapper";
import { AppInitializer } from "@/components/layout/AppInitializer";
import { DynamicModals } from "@/components/layout/DynamicModals";
import { RitualOverlay } from "@/components/features/RitualOverlay";
import QueryProvider from "@/components/layout/QueryProvider";

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
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!settings || settings.onboarding_complete === false) {
    redirect("/onboarding");
  }

  return (
    <>
      <AppInitializer initialSettings={settings} />
      <QueryProvider>
        <AmbientBackground />
        <Sidebar />
        {/* DynamicModals: heavy modals loaded lazily via next/dynamic (ssr:false) to cut ~50-80KB from initial bundle */}
        <DynamicModals />
        <RitualOverlay />
        <FAB />
        <AppContentWrapper>
          {children}
        </AppContentWrapper>
        <BottomNav />
      </QueryProvider>
    </>
  );
}
