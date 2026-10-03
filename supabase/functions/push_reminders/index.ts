// Sends due reminders with Web Push. Called by pg_cron every minute
// (supabase/migrations/20261004090000_push_reminders.sql), gated by
// x-cron-secret like the other scheduled functions.
//
// claim_push_reminders() marks each reminder sent as it returns it, so a
// failed delivery is not retried: a reminder that arrives late is worse than
// one that doesn't arrive, and the task is still in the app.
//
// Secrets: CRON_SECRET, VAPID_KEYS (the JSON from webpush's
// generate-vapid-keys, private key included) and VAPID_SUBJECT (a mailto:
// or https: contact for push services).
import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import {
  type ClaimedReminder,
  pushPayload,
  pushTopic,
  reminderMessage,
} from "./payload.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json(
      {
        error: "Forbidden",
        code: "CRON_AUTH_FAILED",
        message: "A valid scheduler secret is required.",
      },
      401,
    );
  }
  if (!Deno.env.get("VAPID_KEYS") || !Deno.env.get("VAPID_SUBJECT")) {
    return json({ error: "VAPID_KEYS / VAPID_SUBJECT not configured" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: claimed, error } = await supabase.rpc("claim_push_reminders");
  if (error) return json({ error: error.message }, 500);
  const reminders = (claimed ?? []) as ClaimedReminder[];
  if (reminders.length === 0) return json({ claimed: 0, sent: 0 });

  const userIds = [...new Set(reminders.map((r) => r.user_id))];
  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key, app_origin")
    .in("user_id", userIds);
  if (subsError) return json({ error: subsError.message }, 500);

  const server = await appServer();
  const gone = new Set<string>();
  let sent = 0;
  let failed = 0;

  await Promise.all(
    reminders.flatMap((reminder) => {
      const message = reminderMessage(reminder);
      return (subs ?? [])
        .filter((s) => s.user_id === reminder.user_id)
        .map(async (s) => {
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
        });
    }),
  );

  if (gone.size > 0) {
    const { error: deleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", [...gone]);
    if (deleteError)
      console.error("pruning subscriptions", deleteError.message);
  }

  return json({ claimed: reminders.length, sent, failed, pruned: gone.size });
});
