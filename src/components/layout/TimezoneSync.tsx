"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { deviceTimeZone, isValidTimeZone } from "@/lib/zoned-date";
import { useUserId } from "@/components/providers/SessionProvider";
import { useAppStore } from "@/store/useAppStore";

/**
 * Automatic timezone (Settings → "Set timezone automatically", on by
 * default): when the device's timezone differs from the saved one, save the
 * device's, quietly, like a phone's "Set automatically". Reminders are sent
 * by the server and the Do list is drawn there, both in the saved timezone,
 * so it has to follow people when they travel.
 */
export function TimezoneSync() {
  const userId = useUserId();
  const { savedZone, automatic, loaded, updateUserSetting } = useAppStore(
    useShallow((s) => ({
      savedZone: s.userSettings.timezone,
      // Rows from before the switch existed count as automatic.
      automatic: s.userSettings.timezone_auto !== false,
      loaded: Object.keys(s.userSettings).length > 0,
      updateUserSetting: s.updateUserSetting,
    })),
  );

  useEffect(() => {
    if (!loaded || !automatic) return;
    const sync = () => {
      const zone = deviceTimeZone();
      // Never save a zone Intl rejects ("Etc/Unknown" on a misconfigured
      // device): the server renders the Do list in the saved zone.
      if (!zone || zone === savedZone || !isValidTimeZone(zone)) return;
      updateUserSetting("timezone", zone);
      void (async () => {
        const { error } = await createClient()
          .from("user_settings")
          .update({ timezone: zone })
          .eq("user_id", userId);
        // Background and silent: no toast. The next open tries again.
        if (error)
          logger.warn("[timezone] couldn't save the device timezone", error);
      })();
    };
    // When the page is idle: reading the device's zone sets up Intl's locale
    // data, which measured ~25 ms of blocking on a phone-speed load of Home
    // when it ran during hydration. Nothing needs it sooner.
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(sync, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(sync, 2000);
    return () => clearTimeout(id);
  }, [loaded, automatic, savedZone, updateUserSetting, userId]);

  return null;
}
