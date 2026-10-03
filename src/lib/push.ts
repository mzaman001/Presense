import type { createClient } from "@/lib/supabase";

/**
 * This device's Web Push subscription: what lets a reminder reach Presense
 * when it's closed. The server (supabase/functions/push_reminders) sends
 * to every device in push_subscriptions for the user.
 *
 * The public half of the VAPID key pair. The private half is the
 * VAPID_KEYS Edge Function secret; rotating it means changing this too
 * (every device then re-subscribes on its next open, see syncPush).
 */
export const VAPID_PUBLIC_KEY =
  "BGWyDz_t6gkoMkN5jP6wLn4kisRn4l9sK3vWFqUZnWcmX2vMnSM8npg6Bapj1ZYpWI-MOuV7_9x2VM0dozTtmyQ";

type Supabase = ReturnType<typeof createClient>;

export type PushResult =
  "subscribed" | "unsubscribed" | "unavailable" | "failed";

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

/** The worker's registration, waiting briefly if it's still installing. */
async function pushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof window.PushManager === "undefined"
  ) {
    return null;
  }
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);
}

/**
 * Subscribes this device (or refreshes its row) once notification
 * permission is granted. Safe to call on every app open.
 */
export async function enablePush(supabase: Supabase): Promise<PushResult> {
  try {
    if (Notification.permission !== "granted") return "unavailable";
    const registration = await pushRegistration();
    if (!registration) return "unavailable";

    const key = base64UrlToBytes(VAPID_PUBLIC_KEY);
    let subscription = await registration.pushManager.getSubscription();
    // Subscribed under an old key: the server can't reach it any more.
    if (
      subscription &&
      !sameKey(subscription.options.applicationServerKey, key)
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });

    const { endpoint, keys } = subscription.toJSON();
    if (!endpoint || !keys?.p256dh || !keys.auth) return "failed";
    const { error } = await supabase.rpc("register_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: keys.p256dh,
      p_auth: keys.auth,
      p_origin: window.location.origin,
    });
    return error ? "failed" : "subscribed";
  } catch {
    return "failed";
  }
}

/**
 * Stops reminders reaching this device: removes its row first (so the
 * server stops sending even if the browser call fails), then unsubscribes.
 */
export async function disablePush(supabase: Supabase): Promise<PushResult> {
  try {
    const registration = await pushRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return "unsubscribed";
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
    return error ? "failed" : "unsubscribed";
  } catch {
    return "failed";
  }
}

/**
 * Brings this device in line with the Reminders setting on app open.
 * Browsers drop subscriptions without warning (iOS especially), so a
 * device that has permission is re-registered every time.
 */
export async function syncPush(
  supabase: Supabase,
  remindersOn: boolean,
): Promise<PushResult> {
  if (
    typeof window === "undefined" ||
    typeof window.Notification === "undefined"
  ) {
    return "unavailable";
  }
  if (!remindersOn) return disablePush(supabase);
  return enablePush(supabase);
}
