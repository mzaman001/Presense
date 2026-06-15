import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Nightly cron: creates next instances of recurring tasks when they are completed.
// Triggered via Vercel Cron or a scheduled fetch.
export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing environment variables" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find all completed tasks that have a recurrence rule
    // and a completed_at timestamp, meaning we need to create the next instance.
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
        
        // Parse the RRULE to determine next occurrence
        // RRULE format: FREQ=DAILY, FREQ=WEEKLY;BYDAY=MO,WE, FREQ=MONTHLY, etc.
        let nextDate: Date | null = null;

        if (rruleStr.includes("FREQ=DAILY")) {
          nextDate = new Date(completedAt);
          nextDate.setDate(nextDate.getDate() + 1);
          nextDate.setHours(9, 0, 0, 0);
        } else if (rruleStr.includes("FREQ=WEEKLY")) {
          // Parse BYDAY if present
          const bydayMatch = rruleStr.match(/BYDAY=([A-Z,]+)/);
          if (bydayMatch) {
            const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
            const targetDays = bydayMatch[1].split(",").map(d => dayMap[d]).filter(d => d !== undefined);
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
          // Check if a next instance already exists (avoid duplicates)
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

    return NextResponse.json({ 
      success: true, 
      message: "Recurrence cron executed",
      processed: recurringTasks.length,
      created: createdCount
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
