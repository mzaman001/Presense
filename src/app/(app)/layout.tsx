import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Sidebar, BottomNav } from "@/components/layout/Navigation";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { AppContentWrapper } from "@/components/layout/AppContentWrapper";
import { AppInitializer } from "@/components/layout/AppInitializer";
import { DynamicModals } from "@/components/layout/DynamicModals";
import { RitualOverlay } from "@/components/features/RitualOverlay";
import QueryProvider from "@/components/layout/QueryProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

import { MotionProvider } from "@/components/layout/MotionProvider";
import type { UserSettings } from "@/store/useAppStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { NuqsAdapter } from "nuqs/adapters/next/app";

// App layout — shown for all protected (app) pages
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // The proxy (src/proxy.ts) already validated the session via getUser() on
  // every request, so the layout reads the session from cookies instead of
  // repeating a ~300ms auth-server round trip.
  if (!session?.user) {
    redirect("/login");
  }
  const userId = session.user.id;

  // Check if onboarding is complete by looking for user_settings
  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settings || settings.onboarding_complete === false) {
    // If the user already has items/data, they've used the app before —
    // auto-complete onboarding so they aren't stuck in a redirect loop.
    const { count } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count && count > 0) {
      await supabase
        .from("user_settings")
        .upsert(
          { user_id: userId, onboarding_complete: true },
          { onConflict: "user_id" },
        );
    } else {
      redirect("/onboarding");
    }
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-[var(--bg-base)] focus:px-4 focus:py-2.5 focus:text-sm focus:text-[var(--text-1)] focus:no-underline focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
      >
        Skip to content
      </a>
      <AppInitializer
        initialSettings={(settings as UserSettings) || undefined}
      />
      <MotionProvider>
        <QueryProvider>
          <TooltipProvider>
            <RealtimeProvider>
              <ConnectionStatus />
              <UpdatePrompt />
              <AmbientBackground />
              <MobileTopBar />
              <Sidebar />
              <MobileDrawer />
              {/* DynamicModals: heavy modals loaded lazily via next/dynamic (ssr:false) to cut ~50-80KB from initial bundle */}
              <DynamicModals />
              <RitualOverlay />
              <AppContentWrapper>
                <NuqsAdapter>{children}</NuqsAdapter>
              </AppContentWrapper>
              <BottomNav />
            </RealtimeProvider>
          </TooltipProvider>
        </QueryProvider>
      </MotionProvider>
    </>
  );
}
