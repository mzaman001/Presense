import { isIOS, isStandalone } from "@/lib/platform";

/**
 * What this browser can do for the planning reminder.
 * - "needs-home-screen": iPhone/iPad Safari only lets web apps opened from
 *   the Home Screen show notifications, so a tab can't even ask.
 * - "unsupported": no notifications here at all.
 * - otherwise the browser's own permission.
 */
export type ReminderAvailability =
  "unsupported" | "needs-home-screen" | NotificationPermission;

export function getReminderAvailability(): ReminderAvailability {
  if (typeof window === "undefined") return "unsupported";
  if (typeof window.Notification === "undefined") {
    return isIOS() && !isStandalone() ? "needs-home-screen" : "unsupported";
  }
  return Notification.permission;
}

/**
 * Asks the browser for notification permission. Call it straight from a
 * click or tap handler: Firefox and Safari ignore a request that isn't
 * inside a user gesture, and Chrome quietens sites that ask out of the blue.
 */
export function requestReminderPermission(): Promise<NotificationPermission> {
  if (
    typeof window === "undefined" ||
    typeof window.Notification === "undefined"
  ) {
    return Promise.resolve("denied");
  }
  return Notification.requestPermission();
}
