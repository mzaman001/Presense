// Sending Web Push to a user's devices, shared by push_reminders (the
// scheduled reminders) and push_test (Settings → "Send a test").
//
// Secrets: VAPID_KEYS (the JSON from webpush's generate-vapid-keys, private
// key included) and VAPID_SUBJECT (a mailto: or https: contact for push
// services).
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type ReminderMessage,
  pushPayload,
  pushTopic,
} from "./push-payload.ts";

export interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  app_origin: string | null;
}

export const SUBSCRIPTION_COLUMNS =
  "id, user_id, endpoint, p256dh, auth_key, app_origin";

export function vapidConfigured() {
  return Boolean(Deno.env.get("VAPID_KEYS") && Deno.env.get("VAPID_SUBJECT"));
}

let appServerPromise: Promise<webpush.ApplicationServer> | null = null;
function appServer() {
  appServerPromise ??= (async () => {
    const keys = await webpush.importVapidKeys(
      JSON.parse(Deno.env.get("VAPID_KEYS") || "null"),
      { extractable: false },
    );
    return webpush.ApplicationServer.new({
      contactInformation: Deno.env.get("VAPID_SUBJECT") || "",
      vapidKeys: keys,
    });
  })();
  return appServerPromise;
}

export interface SendResult {
  sent: number;
  failed: number;
  /** Subscriptions the push service said are gone (404/410), now deleted. */
  pruned: number;
}

/** Sends each message to its subscriptions, then prunes dead ones. */
export async function sendPushes(
  supabase: SupabaseClient,
  jobs: { message: ReminderMessage; subscriptions: Subscription[] }[],
): Promise<SendResult> {
  const server = await appServer();
  const gone = new Set<string>();
  let sent = 0;
  let failed = 0;

  await Promise.all(
    jobs.flatMap(({ message, subscriptions }) =>
      subscriptions.map(async (s) => {
        try {
          await server
            .subscribe({
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth_key },
            })
            .pushTextMessage(
              JSON.stringify(pushPayload(message, s.app_origin)),
              {
                urgency: webpush.Urgency.High,
                // Worthless after the window it was meant for.
                ttl: 30 * 60,
                topic: pushTopic(message),
              },
            );
          sent++;
        } catch (e) {
          failed++;
          const status =
            e instanceof webpush.PushMessageError ? e.response.status : 0;
          // 404/410: the browser dropped this subscription for good.
          if (status === 404 || status === 410) gone.add(s.id);
          else console.error("push failed", status, String(e));
        }
      }),
    ),
  );

  if (gone.size > 0) {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", [...gone]);
    if (error) console.error("pruning subscriptions", error.message);
  }

  return { sent, failed, pruned: gone.size };
}
