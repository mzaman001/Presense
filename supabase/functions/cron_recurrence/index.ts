import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { data: recurringTasks, error } = await supabase
      .from("items")
      .select("*")
      .eq("status", "done")
      .not("recurrence", "is", null)
      .not("completed_at", "is", null);

    if (error) throw error;

    let createdCount = 0;

    for (const task of recurringTasks) {
      try {
        const completedAt = new Date(task.completed_at);
        const rruleStr: string = task.recurrence;
        
        let nextDate: Date | null = null;

        if (rruleStr.includes("FREQ=DAILY")) {
          nextDate = new Date(completedAt);
          nextDate.setDate(nextDate.getDate() + 1);
          nextDate.setHours(9, 0, 0, 0);
        } else if (rruleStr.includes("FREQ=WEEKLY")) {
          const bydayMatch = rruleStr.match(/BYDAY=([A-Z,]+)/);
          if (bydayMatch) {
            const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
            const targetDays = bydayMatch[1].split(",").map((d: string) => dayMap[d]).filter((d: number) => d !== undefined);
            const cursor = new Date(completedAt);
            cursor.setDate(cursor.getDate() + 1);
            for (let i = 0; i < 14; i++) {
              if (targetDays.includes(cursor.getDay())) {
                nextDate = new Date(cursor);
                nextDate.setHours(9, 0, 0, 0);
                break;
              }
              cursor.setDate(cursor.getDate() + 1);
            }
          } else {
            nextDate = new Date(completedAt);
            nextDate.setDate(nextDate.getDate() + 7);
            nextDate.setHours(9, 0, 0, 0);
          }
        } else if (rruleStr.includes("FREQ=MONTHLY")) {
          nextDate = new Date(completedAt);
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setHours(9, 0, 0, 0);
        }

        if (nextDate) {
          const { data: existing } = await supabase
            .from("items")
            .select("id")
            .eq("user_id", task.user_id)
            .eq("title", task.title)
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
