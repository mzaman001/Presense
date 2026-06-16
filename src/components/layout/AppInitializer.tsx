"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

export function AppInitializer({ initialSettings }: { initialSettings?: any }) {
  const { userSettings, setUserSettings } = useAppStore();

  useEffect(() => {
    if (initialSettings && Object.keys(userSettings).length === 0) {
      setUserSettings(initialSettings);
    }
  }, [initialSettings, userSettings, setUserSettings]);

  useEffect(() => {
    const isOnboarding = window.location.pathname.startsWith('/onboarding');

    // If userSettings is not yet loaded, fallback to localStorage
    const theme = isOnboarding ? 'orange' : (userSettings?.theme || localStorage.getItem('presense_theme') || 'orange');
    const mode = isOnboarding ? 'dark' : (userSettings?.color_mode || localStorage.getItem('presense_color_mode') || 'dark');
    const reduceMotion = userSettings?.reduce_motion || false;

    // Apply Theme
    document.documentElement.classList.remove('theme-blue', 'theme-forest');
    if (theme === 'blue') document.documentElement.classList.add('theme-blue');
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
