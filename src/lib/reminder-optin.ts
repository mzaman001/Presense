import { toast } from "sonner";
import { enablePush } from "@/lib/push";
import {
  getReminderAvailability,
  requestReminderPermission,
} from "@/lib/reminders";
import { createClient } from "@/lib/supabase";
import { track } from "@/lib/track";
import { useAppStore } from "@/store/useAppStore";

/**
 * Turning reminders on where they matter, instead of only in Settings.
 * Reminders are the one thing that brings someone back to Presense, and a
 * "Remind me" time is an empty promise on a device that can't receive one.
 *
 * Two entry points:
 * - turnOnReminders(): straight from a tap ("Turn them on" under Remind me).
 * - offerReminders(): once per device, right after the morning plan is
 *   done, a toast asking whether to be nudged to plan tomorrow.
 */
export type ReminderSource = "task" | "morning_plan";
export type TurnOnResult = "on" | "denied" | "unavailable" | "failed";

const OFFERED_KEY = "presense_reminders_offered";

/**
 * Asks for notification permission (call it inside the tap: browsers
 * ignore or quieten requests outside a user gesture), then registers this
 * device and makes sure the account's Reminders setting is on.
 */
export function turnOnReminders(source: ReminderSource): Promise<TurnOnResult> {
  const availability = getReminderAvailability();
  if (availability === "unsupported" || availability === "needs-home-screen") {
    return Promise.resolve("unavailable");
  }
  if (availability === "denied") return Promise.resolve("denied");
  // Requested synchronously, before any await.
  const permission =
    availability === "granted"
      ? Promise.resolve<NotificationPermission>("granted")
      : requestReminderPermission();

  return permission.then(async (answer) => {
    if (answer !== "granted") return "denied";
    const supabase = createClient();
    const { userSettings, updateUserSetting } = useAppStore.getState();
    if (userSettings?.notifications_enabled === false) {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return "failed";
      const { error } = await supabase
        .from("user_settings")
        .update({ notifications_enabled: true })
        .eq("user_id", userId);
      if (error) return "failed";
      updateUserSetting("notifications_enabled", true);
    }
    const result = await enablePush(supabase);
    if (result !== "subscribed") return "failed";
    track("reminders_turned_on", { source });
    return "on";
  });
}

/** One toast for the outcome, in the house voice. */
export function announceReminderResult(result: TurnOnResult) {
  if (result === "on") {
    toast.success("Reminders are on for this device");
  } else if (result === "denied") {
    toast.error("Notifications are blocked", {
      description: "Settings → Reminders shows how to allow them.",
    });
  } else if (result === "unavailable") {
    toast.error("This browser can't show reminders", {
      description: "On iPhone, add Presense to your Home Screen first.",
    });
  } else {
    toast.error("Couldn't turn reminders on. Please try again.");
  }
}

/**
 * After the morning plan: offer reminders once per device, only when the
 * browser can still ask (never after a "Block"), and only if the account
 * hasn't switched them off on purpose.
 */
export function offerReminders(planningTime: string | null | undefined) {
  if (getReminderAvailability() !== "default") return;
  if (useAppStore.getState().userSettings?.notifications_enabled === false)
    return;
  try {
    if (localStorage.getItem(OFFERED_KEY)) return;
    localStorage.setItem(OFFERED_KEY, String(Date.now()));
  } catch {
    return; // Can't remember the offer: don't risk asking every morning.
  }
  track("reminders_offered", { source: "morning_plan" });
  const when = planningTime ? ` at ${formatPlanningTime(planningTime)}` : "";
  toast("Want a nudge to plan tomorrow?", {
    description: `Presense can remind you${when}, and when a task's "Remind me" time comes.`,
    duration: 12_000,
    action: {
      label: "Turn on",
      onClick: () => {
        void turnOnReminders("morning_plan").then(announceReminderResult);
      },
    },
  });
}

/** "08:00" or "08:00:00" → "8:00 AM" (fixed locale, like the rest of the app). */
export function formatPlanningTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
