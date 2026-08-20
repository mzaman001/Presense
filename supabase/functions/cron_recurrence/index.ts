// INFRA-23 (Aug 17, 2026): `deno.land/std` is maintenance-mode — built-in
// `Deno.serve` is now the standard entry point. The esm.sh resolution path
// for `@supabase/supabase-js` is fragile; the `npm:` specifier is the
// reliable pattern.
import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Fetch nudge_time defaults for all users we'll need
    const userIds = [
      ...new Set(recurringTasks.map((t: { user_id: string }) => t.user_id)),
    ];
    const { data: settingsRows, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, nudge_time")
      .in("user_id", userIds);
    if (settingsError) throw settingsError;

    const nudgeTimeByUser: Record<string, string> = {};
    for (const row of settingsRows || []) {
      nudgeTimeByUser[row.user_id] = row.nudge_time || "09:00";
    }

    let createdCount = 0;

    for (const task of recurringTasks) {
      try {
        const completedAt = new Date(task.completed_at);
        const rruleStr: string = task.recurrence;

        // Parse user's preferred nudge time (default 09:00)
        const nudgeTime = nudgeTimeByUser[task.user_id] || "09:00";
        const [nudgeHour, nudgeMin] = nudgeTime.split(":").map(Number);

        let nextDate: Date | null = null;
        const intervalMatch = rruleStr.match(/INTERVAL=(\d+)/);
        const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : 1;

        if (rruleStr.includes("FREQ=DAILY")) {
          nextDate = new Date(completedAt);
          nextDate.setDate(nextDate.getDate() + interval);
          nextDate.setHours(nudgeHour, nudgeMin, 0, 0);
        } else if (rruleStr.includes("FREQ=WEEKLY")) {
          const bydayMatch = rruleStr.match(/BYDAY=([A-Z,]+)/);
          if (bydayMatch) {
            const dayMap: Record<string, number> = {
              SU: 0,
              MO: 1,
              TU: 2,
              WE: 3,
              TH: 4,
              FR: 5,
              SA: 6,
            };
            const targetDays = bydayMatch[1]
              .split(",")
              .map((d: string) => dayMap[d])
              .filter((d: number) => d !== undefined);
            // For intervals > 1, we look further ahead (interval weeks * 7 days + buffer)
            const lookAheadDays = interval > 1 ? interval * 7 + 7 : 14;
            const cursor = new Date(completedAt);
            cursor.setDate(cursor.getDate() + 1);
            let found = false;
            for (let i = 0; i < lookAheadDays; i++) {
              if (targetDays.includes(cursor.getDay())) {
                // For interval > 1, verify we've moved forward by the right number of weeks
                const daysSinceCompletion = Math.floor(
                  (cursor.getTime() - completedAt.getTime()) / 86400000,
                );
                if (interval <= 1 || daysSinceCompletion >= interval * 7) {
                  nextDate = new Date(cursor);
                  nextDate.setHours(nudgeHour, nudgeMin, 0, 0);
                  found = true;
                  break;
                }
              }
              cursor.setDate(cursor.getDate() + 1);
            }
            if (!found && interval > 1) {
              // Fallback: schedule for the next matching day after interval weeks
              nextDate = new Date(completedAt);
              nextDate.setDate(nextDate.getDate() + interval * 7);
              nextDate.setHours(nudgeHour, nudgeMin, 0, 0);
            }
          } else {
            nextDate = new Date(completedAt);
            nextDate.setDate(nextDate.getDate() + 7 * interval);
            nextDate.setHours(nudgeHour, nudgeMin, 0, 0);
          }
        } else if (rruleStr.includes("FREQ=MONTHLY")) {
          nextDate = new Date(completedAt);
          nextDate.setMonth(nextDate.getMonth() + interval);
          nextDate.setHours(nudgeHour, nudgeMin, 0, 0);
        }

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
            deadline: nextDate.toISOString(),
          });
          if (insertError && insertError.code !== "23505") throw insertError;
          if (!insertError) createdCount++;
        }
      } catch (taskErr: unknown) {
        const msg =
          taskErr instanceof Error ? taskErr.message : String(taskErr);
        console.error(`Failed to process task ${task.id}:`, msg);
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
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});
