import type { TaskRecord } from "@/lib/task-cache";

/**
 * When to offer the stuck-task help ("What's in the way?").
 *
 * Deferral itself is mostly benign: in a year-long study most repeatedly
 * snoozed reminders came back the same day (Weber et al. 2018). So two
 * snoozes in one afternoon are juggling, not avoidance. A task counts as
 * stuck after 2+ deferrals spanning 48h+, or 3+ in any window. The database
 * counts deferrals (items_track_deferral trigger), from every place a task
 * can be put off.
 */
const DAY_MS = 86_400_000;
export const STUCK_AFTER = { deferrals: 2, spanMs: 2 * DAY_MS, anyWindow: 3 };

type StuckFields = Pick<
  TaskRecord,
  "defer_count" | "first_deferred_at" | "stuck_dismissed_until" | "status"
>;

export function isStuck(task: StuckFields, now: number = Date.now()): boolean {
  if (task.status !== "active" && task.status !== "overdue") return false;
  if (
    task.stuck_dismissed_until &&
    Date.parse(task.stuck_dismissed_until) > now
  ) {
    return false;
  }
  const n = task.defer_count ?? 0;
  if (n >= STUCK_AFTER.anyWindow) return true;
  return (
    n >= STUCK_AFTER.deferrals &&
    !!task.first_deferred_at &&
    now - Date.parse(task.first_deferred_at) >= STUCK_AFTER.spanMs
  );
}

/** After a fix is applied: a fresh start, and no dismissal hanging over it. */
export function freshStartPatch() {
  return {
    defer_count: 0,
    first_deferred_at: null,
    stuck_dismissals: 0,
    stuck_dismissed_until: null,
  };
}

/**
 * "Not now": quiet for a day; after a second "not now" in a row, a week.
 * Asking again and again is exactly how a nudge turns into nagging.
 */
export function notNowPatch(
  task: Pick<TaskRecord, "stuck_dismissals">,
  now: number = Date.now(),
) {
  const dismissals = (task.stuck_dismissals ?? 0) + 1;
  return {
    stuck_dismissals: dismissals,
    stuck_dismissed_until: new Date(
      now + (dismissals >= 2 ? 7 : 1) * DAY_MS,
    ).toISOString(),
  };
}

/** "Keep as is": the task is fine as it stands; ask again in a week at most. */
export function keepAsIsPatch(now: number = Date.now()) {
  return {
    ...freshStartPatch(),
    stuck_dismissed_until: new Date(now + 7 * DAY_MS).toISOString(),
  };
}
