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
 * Applies `update` to a list and returns a function that undoes exactly what
 * it changed, on whatever the list has become since: rows it removed come
 * back where they were, rows it changed get their previous values, rows it
 * added go. Restoring a snapshot of the whole list instead also threw away
 * any other optimistic edit made in the meantime.
 */
function patchList(
  list: TaskRecord[],
  update: (tasks: TaskRecord[]) => TaskRecord[],
): { next: TaskRecord[]; undo: (current: TaskRecord[]) => TaskRecord[] } {
  const next = update(list);
  const before = new Map(list.map((t, i) => [t.id, { task: t, index: i }]));
  const after = new Map(next.map((t) => [t.id, t]));
  const removed = list.filter((t) => !after.has(t.id));
  const changed = next.filter(
    (t) => before.has(t.id) && before.get(t.id)!.task !== t,
  );
  const added = next.filter((t) => !before.has(t.id));
  const undo = (current: TaskRecord[]) => {
    const addedIds = new Set(added.map((t) => t.id));
    let out = current
      .filter((t) => !addedIds.has(t.id))
      .map((t) =>
        changed.some((c) => c.id === t.id) ? before.get(t.id)!.task : t,
      );
    for (const task of removed) {
      if (out.some((t) => t.id === task.id)) continue;
      const at = Math.min(before.get(task.id)!.index, out.length);
      out = [...out.slice(0, at), task, ...out.slice(at)];
    }
    return out;
  };
  return { next, undo };
}

/** Patches one list cache; returns its undo. */
function patchListCache(
  queryClient: QueryClient,
  key: readonly unknown[],
  update: (tasks: TaskRecord[]) => TaskRecord[],
): () => void {
  const old = queryClient.getQueryData<TaskRecord[]>(key);
  if (!old) return () => {};
  const { next, undo } = patchList(old, update);
  queryClient.setQueryData<TaskRecord[]>(key, next);
  return () =>
    queryClient.setQueryData<TaskRecord[]>(key, (current) =>
      current ? undo(current) : current,
    );
}

/** Patches the dashboard's task list, keeping its other keys; returns its undo. */
function patchDashboardCache(
  queryClient: QueryClient,
  update: (tasks: TaskRecord[]) => TaskRecord[],
): () => void {
  const old = queryClient.getQueryData<DashboardCache>(DASHBOARD_KEY);
  if (!old) return () => {};
  const { next, undo } = patchList(old.tasks ?? [], update);
  queryClient.setQueryData<DashboardCache>(DASHBOARD_KEY, {
    ...old,
    tasks: next,
  });
  return () =>
    queryClient.setQueryData<DashboardCache>(DASHBOARD_KEY, (current) =>
      current ? { ...current, tasks: undo(current.tasks ?? []) } : current,
    );
}

/**
 * Applies `update` to every cache that holds tasks and returns a function
 * that undoes that change (and only that change) in each.
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
  const undos = [
    ...TASK_LIST_KEYS.map((key) => patchListCache(queryClient, key, update)),
    patchDashboardCache(queryClient, update),
  ];
  return function rollback() {
    for (const undo of undos) undo();
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

/** fetchActiveTasks' order: priority, then deadline, nulls last in both. */
function compareActiveTasks(a: TaskRecord, b: TaskRecord): number {
  const pa = a.priority ?? Infinity;
  const pb = b.priority ?? Infinity;
  if (pa !== pb) return pa - pb;
  const da = a.deadline ? Date.parse(a.deadline) : Infinity;
  const db = b.deadline ? Date.parse(b.deadline) : Infinity;
  return da === db ? 0 : da < db ? -1 : 1;
}

/**
 * Shows a task that was just created before the server confirms it. Only the
 * active-task caches get it (unlike addTaskToCaches, which also writes the
 * inbox list), placed where the next refetch will put it so it doesn't jump.
 */
export function insertNewTaskIntoCaches(
  queryClient: QueryClient,
  task: TaskRecord,
): () => void {
  const undos = [
    patchListCache(queryClient, ["tasks"], (old) => {
      const at = old.findIndex((t) => compareActiveTasks(task, t) < 0);
      return at === -1
        ? [...old, task]
        : [...old.slice(0, at), task, ...old.slice(at)];
    }),
    patchDashboardCache(queryClient, (old) => [...old, task]),
  ];
  return function rollback() {
    for (const undo of undos) undo();
  };
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
