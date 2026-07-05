"use client";

import { useEffect } from "react";
import { useAppStore, UserSettings } from "@/store/useAppStore";
import { applyDocumentTheme, normalizeColorMode, normalizeThemeId } from "@/lib/theme";
import { getRitualDecision } from "@/lib/rituals";
import { usePathname } from "next/navigation";

export function AppInitializer({ initialSettings }: { initialSettings?: UserSettings }) {
  const { userSettings, setUserSettings, setActiveRitual } = useAppStore();
  const pathname = usePathname() || "";

  useEffect(() => {
    if (initialSettings && (!userSettings || Object.keys(userSettings).length === 0)) {
      setUserSettings(initialSettings);
    }
  }, [initialSettings, userSettings, setUserSettings]);

  useEffect(() => {
    if (!userSettings || Object.keys(userSettings).length === 0) return;
    if (window.location.pathname.startsWith("/onboarding")) return;

    const checkRituals = () => {
      if (useAppStore.getState().activeRitual !== null) return;

      const lastClosedAt = parseInt(localStorage.getItem("presense_ritual_closed_at") || "0", 10);
      if (Date.now() - lastClosedAt < 5 * 60 * 1000) return;

      const decision = getRitualDecision({
        now: new Date(),
        nudgeTime: userSettings.nudge_time || "10:00",
        shutdownTime: userSettings.shutdown_time || "18:00",
        lastMorningDate: userSettings.last_ritual_date || null,
        lastEveningDate: userSettings.last_evening_ritual_date || null,
      });

      const notifyAndOpen = (type: "morning" | "evening", message: string) => {
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted" && document.hidden) {
            new Notification(message);
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
        setActiveRitual(type);
      };

      if (decision.kind === "morning") {
        notifyAndOpen("morning", "Time for your morning planning.");
      } else if (decision.kind === "evening") {
        notifyAndOpen("evening", "Time to wind down.");
      }
    };

    const initialTimer = setTimeout(checkRituals, 2000);
    const interval = setInterval(checkRituals, 5 * 60 * 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [userSettings, setActiveRitual]);

  useEffect(() => {
    const isPublicRoute = pathname.startsWith("/onboarding") || pathname.startsWith("/login");
    const isSettingsLoaded = userSettings && Object.keys(userSettings).length > 0;
    
    // If not public and settings haven't loaded yet, do nothing (let layout.tsx initial script handle it)
    if (!isPublicRoute && !isSettingsLoaded) return;

    const theme = normalizeThemeId(
      isPublicRoute ? "warm" : userSettings?.theme
    );
    const mode = normalizeColorMode(
      isPublicRoute ? "dark" : userSettings?.color_mode
    );

    applyDocumentTheme(theme, mode, Boolean(userSettings?.reduce_motion));
    localStorage.setItem("presense_theme", theme);
    localStorage.setItem("presense_color_mode", mode);
  }, [userSettings?.theme, userSettings?.color_mode, userSettings?.reduce_motion, pathname]);

  return null;
}
