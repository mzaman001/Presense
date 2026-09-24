import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TaskRecord } from "@/lib/task-cache";
import { computeRitualStreak } from "@/lib/ritualStreak";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

const DAY_MS = 86_400_000;

/**
 * How far back completions and focus sessions are fetched. "This week" and
 * "last week" are cut from these rows in the viewer's own timezone
 * (summarizeDashboard), so the fetch must cover both weeks wherever the
 * viewer is: at most 13 days back to last Monday, plus a day of slack for
 * the widest UTC offset. The server has no reliable idea of the device's
 * timezone, so it never does the cutting itself.
 */
const HISTORY_DAYS = 15;
/** Long enough for any real morning-ritual streak, still a cheap query. */
const RITUAL_DAYS = 60;

/**
 * Home's raw rows, the same on the server (streamed first load) and in the
 * client query. `tasks` is the active task list: the optimistic helpers in
 * task-cache patch that key directly.
 */
export interface DashboardRows {
  tasks: TaskRecord[];
  inboxItems: TaskRecord[];
  threads: Row<"threads">[];
  recentDone: TaskRecord[];
  recentSessions: Pick<
    Row<"session_logs">,
    "completed_at" | "duration_minutes"
  >[];
  ritualCompletedAt: string[];
  locationsCount: number;
}

export async function fetchDashboardRows(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<DashboardRows> {
  const historyStart = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);
  const ritualStart = new Date(now.getTime() - RITUAL_DAYS * DAY_MS);

  // INFRA-18: explicit user_id filters so the planner can use the
  // per-user indexes rather than relying on the RLS predicate alone.
  const [tasks, inbox, threads, done, sessions, rituals, locations] =
    await Promise.all([
      supabase
        .from("items")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["active", "overdue"])
        .range(0, 99),
      supabase
        .from("items")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "inbox")
        .range(0, 99),
      supabase.from("threads").select("*").eq("user_id", userId).range(0, 99),
      supabase
        .from("items")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "done")
        .gte("completed_at", historyStart.toISOString())
        .order("completed_at", { ascending: false })
        .range(0, 299),
      supabase
        .from("session_logs")
        .select("completed_at, duration_minutes")
        .eq("user_id", userId)
        .eq("type", "work")
        .gte("completed_at", historyStart.toISOString())
        .range(0, 299),
      supabase
        .from("ritual_logs")
        .select("completed_at")
        .eq("user_id", userId)
        .eq("ritual_type", "morning")
        .gte("completed_at", ritualStart.toISOString())
        .range(0, 199),
      // Count only: the tile needs a number, not the rows.
      supabase
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),
    ]);

  const firstError = [tasks, inbox, threads, done, sessions, rituals].find(
    (res) => res.error,
  )?.error;
  if (firstError) throw firstError;

  return {
    tasks: tasks.data ?? [],
    inboxItems: inbox.data ?? [],
    threads: threads.data ?? [],
    recentDone: done.data ?? [],
    recentSessions: sessions.data ?? [],
    ritualCompletedAt: (rituals.data ?? []).map((r) => r.completed_at),
    locationsCount: locations.count ?? 0,
  };
}

/** Monday 00:00 of the week containing `now`, in the device's timezone. */
function mondayStart(now: Date): Date {
  const day = now.getDay() || 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
}

/**
 * What Home shows, cut from the raw rows in the device's timezone. Runs in
 * the browser only (Home renders its data after hydration), so week and day
 * boundaries are the viewer's, not the server's.
 */
export function summarizeDashboard(rows: DashboardRows, now: Date) {
  const weekStart = mondayStart(now).getTime();
  const lastWeekStart = weekStart - 7 * DAY_MS;
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const at = (iso: string | null) => (iso ? Date.parse(iso) : NaN);
  const isToday = (iso: string | null) =>
    at(iso) >= todayStart && at(iso) < todayStart + DAY_MS;
  const isOverdue = (iso: string | null) => at(iso) < now.getTime();

  // Overdue first, then urgent, then high-priority tasks due today, then by
  // deadline, then by priority.
  const upNext = rows.tasks
    .filter((t) => !t.snoozed_until || at(t.snoozed_until) <= now.getTime())
    .toSorted((a, b) => {
      const aPrio = a.priority ?? 4;
      const bPrio = b.priority ?? 4;
      const aOverdue = isOverdue(a.deadline);
      const bOverdue = isOverdue(b.deadline);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if ((aPrio === 1) !== (bPrio === 1)) return aPrio === 1 ? -1 : 1;
      const aTodayHigh = isToday(a.deadline) && aPrio === 2;
      const bTodayHigh = isToday(b.deadline) && bPrio === 2;
      if (aTodayHigh !== bTodayHigh) return aTodayHigh ? -1 : 1;
      if (a.deadline && b.deadline) return at(a.deadline) - at(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return aPrio - bPrio;
    });

  const inWeek = (iso: string | null, start: number) =>
    at(iso) >= start && at(iso) < start + 7 * DAY_MS;

  const doneTasks = rows.recentDone.filter((t) =>
    inWeek(t.completed_at, weekStart),
  );
  const doneTasksLastWeek = rows.recentDone.filter((t) =>
    inWeek(t.completed_at, lastWeekStart),
  );
  const sessionsThisWeek = rows.recentSessions.filter((s) =>
    inWeek(s.completed_at, weekStart),
  );
  const minutes = (list: DashboardRows["recentSessions"]) =>
    list.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);

  // Monday-indexed (0 = Mon … 6 = Sun), matching the week above.
  const dayCounts = new Array(7).fill(0) as number[];
  for (const task of doneTasks) {
    dayCounts[(new Date(task.completed_at!).getDay() + 6) % 7]++;
  }

  return {
    tasks: upNext,
    inboxItems: rows.inboxItems,
    threads: rows.threads,
    doneTasks,
    pomodorosThisWeek: sessionsThisWeek.length,
    doneTasksLastWeek,
    focusMinutesThisWeek: minutes(sessionsThisWeek),
    focusMinutesLastWeek: minutes(
      rows.recentSessions.filter((s) => inWeek(s.completed_at, lastWeekStart)),
    ),
    dayCounts,
    ritualStreak: computeRitualStreak(
      rows.ritualCompletedAt.map((iso) =>
        new Date(iso).toLocaleDateString("en-CA"),
      ),
      now,
    ),
    locationsCount: rows.locationsCount,
  };
}

export type DashboardSummary = ReturnType<typeof summarizeDashboard>;
