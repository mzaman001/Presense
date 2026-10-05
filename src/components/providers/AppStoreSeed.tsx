"use client";

import { useState, type ReactNode } from "react";
import {
  SettingsSeedContext,
  useAppStore,
  type UserSettings,
} from "@/store/useAppStore";

/**
 * Puts the server's settings in the store before anything below renders, so
 * the hydrating render matches the server's HTML and nothing re-renders once
 * it's on screen. Settings already in the store (changed since, or kept
 * across a client navigation) win.
 */
export function AppStoreSeed({
  settings,
  children,
}: {
  settings: UserSettings | null;
  children: ReactNode;
}) {
  // useState's initializer runs once, before the children render. On the
  // server the shared store is left alone: useAppStore reads the seed from
  // context there instead.
  useState(() => {
    if (
      typeof window !== "undefined" &&
      settings &&
      Object.keys(useAppStore.getState().userSettings).length === 0
    ) {
      useAppStore.setState({ userSettings: settings });
    }
  });
  return (
    <SettingsSeedContext.Provider value={settings}>
      {children}
    </SettingsSeedContext.Provider>
  );
}
