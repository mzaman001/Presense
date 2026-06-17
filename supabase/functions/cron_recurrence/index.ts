import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
    const userIds = [...new Set(recurringTasks.map((t: any) => t.user_id))];
    const { data: settingsRows } = await supabase
      .from("user_settings")
      .select("user_id, nudge_time")
      .in("user_id", userIds);

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
            const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
            const targetDays = bydayMatch[1].split(",").map((d: string) => dayMap[d]).filter((d: number) => d !== undefined);
            // For intervals > 1, we look further ahead (interval weeks * 7 days + buffer)
            const lookAheadDays = interval > 1 ? interval * 7 + 7 : 14;
            const cursor = new Date(completedAt);
            cursor.setDate(cursor.getDate() + 1);
            let found = false;
            for (let i = 0; i < lookAheadDays; i++) {
              if (targetDays.includes(cursor.getDay())) {
                // For interval > 1, verify we've moved forward by the right number of weeks
                const daysSinceCompletion = Math.floor((cursor.getTime() - completedAt.getTime()) / 86400000);
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
          // Better dedup: match on title AND recurrence pattern, not just title alone.
          // This prevents two genuinely different tasks with the same title from colliding.
          const { data: existing } = await supabase
            .from("items")
            .select("id")
            .eq("user_id", task.user_id)
            .eq("title", task.title)
            .eq("recurrence", task.recurrence)
            .eq("status", "active")
            .maybeSingle();

          if (!existing) {
            await supabase.from("items").insert({
              user_id: task.user_id,
              title: task.title,
              category: task.category,
              priority: task.priority,
              first_step: task.first_step,
              ifthen_trigger: task.ifthen_trigger,
              recurrence: task.recurrence,
              deadline: nextDate.toISOString(),
              status: "active"
            });
            createdCount++;
          }
        }
      } catch (taskErr: any) {
        console.error(`Failed to process task ${task.id}:`, taskErr.message);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Recurrence cron executed",
        processed: recurringTasks.length,
        created: createdCount
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    )
  }
})
