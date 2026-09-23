import type { UserSettings } from "@/store/useAppStore";

/**
 * The morning-planning / evening-shutdown reminder as a system notification.
 * The ritual itself always opens in-app; this only reaches a user who has
 * the tab in the background, and only if they left notifications on
 * (Settings → Reminders). Unset counts as on, matching the switch's default.
 */
export function notifyRitual(
  message: string,
  settings: Pick<Partial<UserSettings>, "notifications_enabled">,
) {
  if (settings.notifications_enabled === false) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    if (document.hidden) new Notification(message);
  } else if (Notification.permission !== "denied") {
    void Notification.requestPermission();
  }
}
