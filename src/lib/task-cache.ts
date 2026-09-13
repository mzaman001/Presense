import type { QueryClient } from "@tanstack/react-query";
import type { Database } from "@/types/database.types";

/** A row of `items` as every task surface reads it. */
export type TaskRecord = Database["public"]["Tables"]["items"]["Row"];

/**
 * A checklist entry on a task. The column is `jsonb[]`, so the generated type
 * is `Json[]`; this is the shape the app actually writes and reads.
 */
export interface Subtask {
  text: string;
  completed: boolean;
}

/** Narrows a task's `subtasks` column to the shape the UI expects. */
export function readSubtasks(
  subtasks: TaskRecord["subtasks"] | undefined,
): Subtask[] {
  if (!Array.isArray(subtasks)) return [];
  return subtasks.flatMap((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? [
          {
            text: String((entry as Record<string, unknown>).text ?? ""),
            completed: Boolean((entry as Record<string, unknown>).completed),
          },
        ]
      : [],
  );
}

/**
 * The subset of the dashboard cache that holds tasks. The dashboard query
 * returns more than this; the extra keys are preserved untouched.
 */
interface DashboardCache {
  tasks?: TaskRecord[];
  [key: string]: unknown;
}

/** Every cached query whose value contains task rows. */
const TASK_LIST_KEYS = [["tasks"], ["inbox-tasks"]] as const;
const DASHBOARD_KEY = ["dashboard"] as const;

/**
 * Applies `update` to every cache that holds tasks and returns a function
 * that puts the previous values back.
 *
 * Optimistic task edits previously inlined this at each call site: read
 * `["tasks"]` and `["dashboard"]`, write both, and remember both for
 * rollback — repeated per action, untyped, and easy to leave a cache out of.
 * Routing it through one place means a new task cache is registered above
 * once rather than in every handler.
 */
export function patchTaskCaches(
  queryClient: QueryClient,
  update: (tasks: TaskRecord[]) => TaskRecord[],
): () => void {
  const snapshots = TASK_LIST_KEYS.map(
    (key) => [key, queryClient.getQueryData<TaskRecord[]>(key)] as const,
  );
  const dashboardSnapshot =
    queryClient.getQueryData<DashboardCache>(DASHBOARD_KEY);

  for (const [key] of snapshots) {
    queryClient.setQueryData<TaskRecord[]>(key, (old) =>
      old ? update(old) : old,
    );
  }
  queryClient.setQueryData<DashboardCache>(DASHBOARD_KEY, (old) =>
    old ? { ...old, tasks: update(old.tasks ?? []) } : old,
  );

  return function rollback() {
    for (const [key, value] of snapshots) {
      queryClient.setQueryData(key, value);
    }
    queryClient.setQueryData(DASHBOARD_KEY, dashboardSnapshot);
  };
}

/** Removes one task from every task cache. */
export function removeTaskFromCaches(
  queryClient: QueryClient,
  taskId: string,
): () => void {
  return patchTaskCaches(queryClient, (tasks) =>
    tasks.filter((task) => task.id !== taskId),
  );
}

/** Adds a task back to every task cache (used by undo). */
export function addTaskToCaches(
  queryClient: QueryClient,
  task: TaskRecord,
): () => void {
  return patchTaskCaches(queryClient, (tasks) =>
    tasks.some((existing) => existing.id === task.id)
      ? tasks
      : [...tasks, task],
  );
}

/** Merges a partial change into one task across every task cache. */
export function updateTaskInCaches(
  queryClient: QueryClient,
  taskId: string,
  changes: Partial<TaskRecord>,
): () => void {
  return patchTaskCaches(queryClient, (tasks) =>
    tasks.map((task) => (task.id === taskId ? { ...task, ...changes } : task)),
  );
}
