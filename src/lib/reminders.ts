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

/**
 * How to unblock notifications, for the device in hand. Browsers never ask
 * again once a site is blocked, so this is the only way back; a vague
 * "check your settings" leaves people stuck.
 */
export function unblockSteps(userAgent: string, standalone: boolean): string {
  if (/Android/i.test(userAgent)) {
    return standalone
      ? "Notifications are blocked for the Presense app. Long-press its icon, tap App info → Notifications, allow them, then tap Check again."
      : "Chrome has blocked notifications for Presense. Tap the icon left of the address bar → Permissions → Notifications → Allow, then tap Check again. If they're already allowed, turn on Android Settings → Apps → Chrome → Notifications.";
  }
  if (
    /iP(hone|ad|od)/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && standalone)
  ) {
    return "Notifications are off for Presense. Open Settings → Notifications → Presense, allow notifications, then tap Check again.";
  }
  return "Your browser has blocked notifications for Presense. Click the icon left of the address bar, allow Notifications, then choose Check again.";
}
