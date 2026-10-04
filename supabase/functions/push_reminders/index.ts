// Sends due reminders with Web Push. Called by pg_cron every minute
// (supabase/migrations/20261004090000_push_reminders.sql), gated by
// x-cron-secret like the other scheduled functions.
//
// claim_push_reminders() marks each reminder sent as it returns it, so a
// failed delivery is not retried: a reminder that arrives late is worse than
// one that doesn't arrive, and the task is still in the app.
//
// Secrets: CRON_SECRET, plus VAPID_KEYS / VAPID_SUBJECT (_shared/send-push.ts).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type ClaimedReminder,
  reminderMessage,
} from "../_shared/push-payload.ts";
import {
  sendPushes,
  SUBSCRIPTION_COLUMNS,
  type Subscription,
  vapidConfigured,
} from "../_shared/send-push.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
  if (!vapidConfigured()) {
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
    .select(SUBSCRIPTION_COLUMNS)
    .in("user_id", userIds);
  if (subsError) return json({ error: subsError.message }, 500);

  const result = await sendPushes(
    supabase,
    reminders.map((reminder) => ({
      message: reminderMessage(reminder),
      subscriptions: ((subs ?? []) as Subscription[]).filter(
        (s) => s.user_id === reminder.user_id,
      ),
    })),
  );

  return json({ claimed: reminders.length, ...result });
});
