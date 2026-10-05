import type { TaskRecord } from "@/lib/task-cache";
import { dateKeyIn } from "@/lib/zoned-date";

/** The timezone and moment the Do list is drawn for (see display-clock). */
export interface Clock {
  /** IANA zone; undefined means the device's. */
  timeZone?: string;
  /** Epoch ms. */
  now: number;
}

type BucketTask = Pick<
  TaskRecord,
  "id" | "status" | "deadline" | "start_date" | "category"
>;

/**
 * Splits Do's tasks into Overdue / Today / Upcoming / Someday in one pass
 * (PERF-15), for an explicit timezone and moment so the server and the
 * browser draw the same list. Overdue: the deadline has passed. Today: due
 * later on today's date in that zone.
 */
export function bucketTasks<T extends BucketTask>(
  tasks: T[],
  categoryFilter: string,
  clock: Clock,
) {
  const today = dateKeyIn(new Date(clock.now), clock.timeZone);
  const buckets = {
    overdue: [] as T[],
    today: [] as T[],
    upcoming: [] as T[],
    someday: [] as T[],
  };

  for (const t of tasks) {
    // Not started yet.
    if (t.start_date && Date.parse(t.start_date) > clock.now) continue;

    const isActiveOrOverdue = t.status === "active" || t.status === "overdue";
    const due = t.deadline ? Date.parse(t.deadline) : null;
    const dueToday =
      due !== null && dateKeyIn(new Date(due), clock.timeZone) === today;

    if (categoryFilter === "all") {
      if (!isActiveOrOverdue) continue;
    } else if (categoryFilter === "inbox") {
      if (t.status !== "inbox") continue;
    } else if (categoryFilter === "today") {
      if (due === null || !isActiveOrOverdue) continue;
      if (!(due <= clock.now || dueToday)) continue;
    } else if (t.category !== categoryFilter || !isActiveOrOverdue) {
      continue;
    }

    if (due === null) buckets.someday.push(t);
    else if (due < clock.now) buckets.overdue.push(t);
    else if (dueToday) buckets.today.push(t);
    else buckets.upcoming.push(t);
  }

  return buckets;
}
