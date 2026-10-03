"use client";

import { useEffect } from "react";
import { syncPush } from "@/lib/push";
import { createClient } from "@/lib/supabase";
import { useAppStore, UserSettings } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import {
  applyDocumentTheme,
  normalizeColorMode,
  normalizeThemeId,
} from "@/lib/theme";
import { getRitualDecision } from "@/lib/rituals";
import { isFirstRun } from "@/lib/first-run";
import { usePathname } from "next/navigation";

const RITUAL_SNOOZE_MS = 3 * 60 * 60 * 1000; // 3 hours

export function AppInitializer({
  initialSettings,
}: {
  initialSettings?: UserSettings;
}) {
  const { userSettings, setUserSettings, setActiveRitual } = useAppStore(
    useShallow((s) => ({
      userSettings: s.userSettings,
      setUserSettings: s.setUserSettings,
      setActiveRitual: s.setActiveRitual,
    })),
  );
  const pathname = usePathname() || "";

  useEffect(() => {
    if (
      initialSettings &&
      (!userSettings || Object.keys(userSettings).length === 0)
    ) {
      setUserSettings(initialSettings);
    }
  }, [initialSettings, userSettings, setUserSettings]);

  useEffect(() => {
    if (!userSettings || Object.keys(userSettings).length === 0) return;
    if (window.location.pathname.startsWith("/onboarding")) return;

    const checkRituals = () => {
      if (useAppStore.getState().activeRitual !== null) return;

      // Straight from onboarding: the first Plan my day opens now, whatever
      // the time, and isn't held back by an earlier close.
      if (isFirstRun()) {
        setActiveRitual("morning");
        return;
      }

      const lastClosedAt = parseInt(
        localStorage.getItem("presense_ritual_closed_at") || "0",
        10,
      );
      // Closing the ritual means "not now", not "ask again in 5 minutes".
      // Home and the rail keep a quiet "Plan my day" entry point meanwhile.
      if (Date.now() - lastClosedAt < RITUAL_SNOOZE_MS) return;

      const decision = getRitualDecision({
        now: new Date(),
        nudgeTime: userSettings.nudge_time || "10:00",
        shutdownTime: userSettings.shutdown_time || "18:00",
        lastMorningDate: userSettings.last_ritual_date || null,
        lastEveningDate: userSettings.last_evening_ritual_date || null,
      });

      // The system notification for a ritual comes from the server
      // (push_reminders), so it arrives with the app closed too.
      if (decision.kind === "morning" || decision.kind === "evening") {
        setActiveRitual(decision.kind);
      }
    };

    const initialTimer = setTimeout(checkRituals, isFirstRun() ? 300 : 2000);
    const interval = setInterval(checkRituals, 5 * 60 * 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [userSettings, setActiveRitual]);

  // Re-register this device for reminders on every open: browsers drop push
  // subscriptions without telling anyone (iOS especially). Once per load.
  const remindersOn =
    Object.keys(userSettings ?? {}).length === 0
      ? null
      : userSettings.notifications_enabled !== false;
  useEffect(() => {
    if (remindersOn === null || process.env.NODE_ENV !== "production") return;
    const timer = setTimeout(() => {
      void syncPush(createClient(), remindersOn);
    }, 3000);
    return () => clearTimeout(timer);
  }, [remindersOn]);

  useEffect(() => {
    const isPublicRoute =
      pathname.startsWith("/onboarding") || pathname.startsWith("/login");
    const isSettingsLoaded =
      userSettings && Object.keys(userSettings).length > 0;

    // If not public and settings haven't loaded yet, do nothing (let layout.tsx initial script handle it)
    if (!isPublicRoute && !isSettingsLoaded) return;

    const theme = normalizeThemeId(
      isPublicRoute ? "warm" : userSettings?.theme,
    );
    const mode = normalizeColorMode(
      isPublicRoute ? "dark" : userSettings?.color_mode,
    );

    applyDocumentTheme(
      theme,
      mode,
      Boolean(userSettings?.reduce_motion),
      userSettings?.density,
    );
    localStorage.setItem("presense_theme", theme);
    localStorage.setItem("presense_color_mode", mode);
    if (userSettings?.density) {
      localStorage.setItem("presense_density", userSettings.density as string);
    }
  }, [
    userSettings?.theme,
    userSettings?.color_mode,
    userSettings?.reduce_motion,
    userSettings?.density,
    pathname,
  ]);

  return null;
}
