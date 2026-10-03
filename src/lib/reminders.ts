import type { UserSettings } from "@/store/useAppStore";
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
 * The morning-planning / evening-shutdown reminder as a system notification.
 * The ritual itself always opens in-app; this only reaches a user who has
 * Presense open in the background, left the reminder on (Settings →
 * Reminders; unset counts as on) and already granted permission there. It
 * never asks for permission itself: a prompt fired from a timer is ignored
 * or penalised by browsers.
 *
 * Shown through the service worker where there is one, because Android
 * Chrome throws on `new Notification()`. Never rejects: a reminder is a
 * nicety and must not stop the ritual from opening.
 */
export async function notifyRitual(
  message: string,
  settings: Pick<Partial<UserSettings>, "notifications_enabled">,
): Promise<void> {
  if (settings.notifications_enabled === false) return;
  if (getReminderAvailability() !== "granted") return;
  if (!document.hidden) return;

  const options: NotificationOptions = {
    // A new ritual reminder replaces an unread one instead of stacking.
    tag: "presense-ritual",
    icon: "/icon-192.png",
    data: { url: "/" },
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(message, options);
      return;
    }
    new Notification(message, options);
  } catch {
    // Nothing useful to do; the ritual is waiting in the app.
  }
}
