import type { TaskRecord } from "@/lib/task-cache";

/**
 * The calendar renders the same `items` row every other task surface does.
 * This alias used to be a hand-written subset that drifted from the column
 * nullability and forced casts at each boundary.
 */
export type Task = TaskRecord;
