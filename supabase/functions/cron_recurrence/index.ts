// INFRA-23 (Aug 17, 2026): `deno.land/std` is maintenance-mode — built-in
// `Deno.serve` is now the standard entry point. The esm.sh resolution path
// for `@supabase/supabase-js` is fragile; the `npm:` specifier is the
// reliable pattern.
import { createClient } from "npm:@supabase/supabase-js@2";
import { nextOccurrence } from "./next-occurrence.ts";

Deno.serve(async (req) => {
  // AUDIT-04 (Aug 19, 2026): `verify_jwt = true` alone was not enough — any
  // signed *user* JWT satisfied it, so any logged-in user could trigger this
  // service-role, RLS-bypassing sweep. A configured CRON_SECRET secret now
  // gates authority: the trigger must send `x-cron-secret: <secret>`. If the
  // secret is configured and missing or wrong, 401 with a stable error code
  // (no info leak — never echoes the expected value). If CRON_SECRET is not
  // configured, fall back to the previous JWT presence check (SEC2-02) so
  // deployment stays compatible until the secret is set.
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (cronSecret) {
    if (req.headers.get("x-cron-secret") !== cronSecret) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          code: "CRON_AUTH_FAILED",
          message: "A valid scheduler secret is required.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  } else if (!req.headers.get("Authorization")) {
    return new Response(
      JSON.stringify({
        error: "No Authorization header — scheduled invocation must send a JWT",
        code: "CRON_AUTH_FAILED",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Only scan tasks completed in the last 90 days to avoid unbounded full-table scan
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: recurringTasks, error } = await supabase
      .from("items")
      .select("*")
      .eq("status", "done")
      .not("recurrence", "is", null)
      .not("completed_at", "is", null)
      .gte("completed_at", ninetyDaysAgo.toISOString());

    if (error) throw error;

    // Fetch nudge_time defaults and timezones for all users we'll need
    const userIds = [
      ...new Set(recurringTasks.map((t) => t.user_id as string)),
    ];
    const { data: settingsRows, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, nudge_time, timezone")
      .in("user_id", userIds);
    if (settingsError) throw settingsError;

    const nudgeTimeByUser: Record<string, string> = {};
    const timezoneByUser: Record<string, string | null> = {};
    for (const row of settingsRows || []) {
      nudgeTimeByUser[row.user_id] = row.nudge_time || "09:00";
      timezoneByUser[row.user_id] = row.timezone;
    }

    let createdCount = 0;

    for (const task of recurringTasks) {
      try {
        const completedAt = new Date(task.completed_at);
        const rruleStr: string = task.recurrence;

        // The user's nudge time (default 09:00), for tasks that had no
        // due time of their own.
        const nudgeTime = nudgeTimeByUser[task.user_id] || "09:00";
        const [nudgeHour, nudgeMin] = nudgeTime.split(":").map(Number);

        // Same calendar rules as the task parser, in the user's timezone,
        // keeping the task's own time of day (see next-occurrence.ts).
        const nextDate = nextOccurrence({
          rrule: rruleStr,
          completedAt,
          previousDeadline: task.deadline ? new Date(task.deadline) : null,
          timeZone: timezoneByUser[task.user_id],
          fallbackTime: {
            hour: Number.isFinite(nudgeHour) ? nudgeHour : 9,
            minute: Number.isFinite(nudgeMin) ? nudgeMin : 0,
          },
        });

        if (nextDate) {
          // INFRA-23 (Aug 17, 2026): the old check-then-insert (maybeSingle
          // then insert) raced under overlapping invocations — a retry or
          // manual trigger could duplicate a recurring task. Uniqueness is
          // now enforced by a partial unique index on
          // (user_id, title, recurrence) WHERE status = 'active'
          // (migration 20260817000003): insert directly and treat a
          // unique-violation (Postgres 23505) as "the sibling already
          // exists — that is a success". No window between check and insert.
          const { error: insertError } = await supabase.from("items").insert({
            user_id: task.user_id,
            title: task.title,
            category: task.category,
            priority: task.priority,
            first_step: task.first_step,
            ifthen_trigger: task.ifthen_trigger,
            recurrence: task.recurrence,
            time_estimate: task.time_estimate,
            deadline: nextDate.toISOString(),
          });
          if (insertError && insertError.code !== "23505") throw insertError;
          if (!insertError) createdCount++;
        }
      } catch (taskErr: unknown) {
        const msg =
          taskErr instanceof Error ? taskErr.message : String(taskErr);
        console.error("Failed to process task:", task.id, msg);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Recurrence cron executed",
        processed: recurringTasks.length,
        created: createdCount,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    // Details go to the function logs only: database error text can describe
    // schema and data, and the caller (the scheduler) only needs to know it
    // failed. CodeQL js/stack-trace-exposure.
    console.error("cron_recurrence failed:", err);
    return new Response(
      JSON.stringify({
        error: "cron_recurrence failed. See the function logs.",
      }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});
