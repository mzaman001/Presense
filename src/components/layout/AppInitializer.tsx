"use client";

import { useEffect } from "react";
import { useAppStore, UserSettings } from "@/store/useAppStore";

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

      const shouldTriggerMorning = lastRitualDate !== todayString && isTimeAfter(nudgeTime);
      const hasDoneEveningToday = localStorage.getItem('presense_evening_ritual_date') === todayString;
      const shouldTriggerEvening = !hasDoneEveningToday && isTimeAfter(shutdownTime);

      if (useAppStore.getState().activeRitual === null) {
        if (shouldTriggerMorning) {
          setActiveRitual('morning');
        } else if (shouldTriggerEvening) {
          setActiveRitual('evening');
        }
      }
    };

    // Run immediately on load
    checkRituals();

    // Check every 60 seconds (tick)
    const interval = setInterval(checkRituals, 60000);
    return () => clearInterval(interval);
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
