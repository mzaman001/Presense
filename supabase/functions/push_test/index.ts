// Settings → Reminders → "Send a test": pushes one notification to every
// device the signed-in user has registered, so they can see reminders work
// without setting one up and waiting.
//
// Called by the app with the user's own session (verify_jwt). It can only
// ever reach the caller's own devices, and at most once every 20 seconds.
// Secrets: VAPID_KEYS / VAPID_SUBJECT (_shared/send-push.ts).
import { createClient } from "npm:@supabase/supabase-js@2";
import { testMessage } from "../_shared/push-payload.ts";
import {
  sendPushes,
  SUBSCRIPTION_COLUMNS,
  type Subscription,
  vapidConfigured,
} from "../_shared/send-push.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const COOLDOWN_MS = 20_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!vapidConfigured()) {
    return json({ error: "Push isn't configured on the server." }, 500);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const authorization = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
  } = await asUser.auth.getUser();
  if (!user) return json({ error: "Sign in first." }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Claim the cooldown atomically, so rapid taps send one test.
  const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("user_settings")
    .update({ last_test_push_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .or(`last_test_push_at.is.null,last_test_push_at.lt.${since}`)
    .select("user_id");
  if (claimError) return json({ error: claimError.message }, 500);
  if (!claimed?.length) {
    return json({ error: "Wait a few seconds before sending another." }, 429);
  }

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("user_id", user.id);
  if (error) return json({ error: error.message }, 500);
  const subscriptions = (subs ?? []) as Subscription[];
  if (subscriptions.length === 0) return json({ devices: 0, sent: 0 });

  const result = await sendPushes(admin, [
    { message: testMessage(), subscriptions },
  ]);
  return json({ devices: subscriptions.length, ...result });
});
