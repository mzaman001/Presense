"use client";

import { useEffect } from "react";
import { useAppStore, UserSettings } from "@/store/useAppStore";
import { toast } from "sonner";

function isTimeAfter(timeStr: string) {
  if (!timeStr) return false;
  const [h, m, s] = timeStr.split(":").map(Number);
  const now = new Date();
  const nowInSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const targetInSecs = h * 3600 + (m || 0) * 60 + (s || 0);
  return nowInSecs >= targetInSecs;
}

export function AppInitializer({ initialSettings }: { initialSettings?: UserSettings }) {
  const { userSettings, setUserSettings, setActiveRitual } = useAppStore();

  useEffect(() => {
    if (initialSettings && (!userSettings || Object.keys(userSettings).length === 0)) {
      setUserSettings(initialSettings);
    }
  }, [initialSettings, userSettings, setUserSettings]);

  useEffect(() => {
    if (!userSettings || Object.keys(userSettings).length === 0) return;
    const isOnboarding = window.location.pathname.startsWith('/onboarding');
    if (isOnboarding) return;

    const checkRituals = () => {
      const todayString = new Date().toLocaleDateString('en-CA');
      const nudgeTime = userSettings.nudge_time || '10:00:00';
      const shutdownTime = userSettings.shutdown_time || '18:00:00';
      const lastRitualDate = userSettings.last_ritual_date;

      // Don't interrupt if a ritual is already open
      if (useAppStore.getState().activeRitual !== null) return;

      // Don't fire within 5 minutes of a ritual being closed (prevents back-to-back chaining)
      const lastClosedAt = parseInt(localStorage.getItem('presense_ritual_closed_at') || '0', 10);
      if (Date.now() - lastClosedAt < 5 * 60 * 1000) return;

      // Rule 1 — Morning: fires if not yet done today AND past nudge time
      const morningDoneToday = lastRitualDate === todayString;
      const shouldTriggerMorning = !morningDoneToday && isTimeAfter(nudgeTime);

      // Rule 2 — Evening: ONLY fires if morning was already completed today
      //           AND past shutdown time AND evening not yet done today
      const eveningDoneToday = userSettings.last_evening_ritual_date === todayString;
      const shouldTriggerEvening = morningDoneToday && !eveningDoneToday && isTimeAfter(shutdownTime);

      const notifyAndOpen = (type: 'morning' | 'evening', message: string) => {
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted" && document.hidden) {
            new Notification(message);
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
        setActiveRitual(type);
      };

      if (shouldTriggerMorning) {
        notifyAndOpen('morning', "Time for your morning planning ☀️");
      } else if (shouldTriggerEvening) {
        notifyAndOpen('evening', "Time to wind down 🌙");
      }
    };

    // Slight delay on initial load so the UI is ready
    const initialTimer = setTimeout(checkRituals, 2000);

    // Check every 5 minutes (Sunsama-style — no need to hammer every 60s)
    const interval = setInterval(checkRituals, 5 * 60 * 1000);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, [userSettings, setActiveRitual]);


  useEffect(() => {
    const isOnboarding = window.location.pathname.startsWith('/onboarding');

    // If userSettings is not yet loaded, fallback to localStorage
    const theme = isOnboarding ? 'orange' : (userSettings?.theme || localStorage.getItem('presense_theme') || 'orange');
    const mode = isOnboarding ? 'dark' : (userSettings?.color_mode || localStorage.getItem('presense_color_mode') || 'dark');
    const reduceMotion = userSettings?.reduce_motion || false;

    // Apply Theme
    document.documentElement.classList.remove('theme-navy', 'theme-forest');
    if (theme === 'blue') document.documentElement.classList.add('theme-navy');
    if (theme === 'forest') document.documentElement.classList.add('theme-forest');

    // Apply Color Mode
    document.documentElement.classList.remove('light');
    if (mode === 'light' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) {
      document.documentElement.classList.add('light');
    }

    // Apply Reduce Motion
    if (reduceMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }

    // Keep localStorage in sync for initial SSR hydration
    if (userSettings?.theme) localStorage.setItem('presense_theme', theme);
    if (userSettings?.color_mode) localStorage.setItem('presense_color_mode', mode);

  }, [userSettings?.theme, userSettings?.color_mode, userSettings?.reduce_motion]);

  return null;
}
