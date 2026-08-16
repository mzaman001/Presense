export type RestorableItemStatus = "active" | "inbox" | "done" | "archived";

// INFRA-19: every status write on an entity table goes through this module.
// `archiveItemPatch` is the archive transition (archived ≠ deleted — archive is
// "put aside", trash is "removed"; keep the two meanings distinct, per BUG-08).
export function archiveItemPatch() {
  return { status: "archived", deleted_at: null };
}

// INFRA-19: the done transition — must always stamp completed_at. Sites that
// wrote `{ status: "done" }` without `completed_at` were a latent bug (the Do
// archive view sorts by `completed_at` desc).
export function completeTaskPatch(now = new Date()) {
  return { status: "done", completed_at: now.toISOString() };
}

// INFRA-19: the un-complete transition — clears completed_at. Writing
// `{ status: "active" }` alone would resurrect a task as "done" in the archive
// view because its stale completed_at would still rank it there.
export function uncompleteTaskPatch() {
  return { status: "active", completed_at: null };
}

// INFRA-19: routing inbox → Do. This is activation, not a restore: it does not
// touch deleted_at or completed_at. inbox is a valid RestorableItemStatus but
// a route is neither an un-archive nor a trash-restore, so it gets its own
// patch instead of (mis)using restoreItemPatch("active").
export function activateItemPatch() {
  return { status: "active" };
}

// INFRA-19: archive toggle for threads/explores — archive to `archived` and
// clear deleted_at (a trashed thread is un-trashable by restoring, then
// archived separately if desired). Un-archiving goes through
// restoreItemPatch("active").
export function archiveThreadPatch() {
  return { status: "archived", deleted_at: null };
}

// INFRA-19: triage — routing a task to Today / Backlog / Snooze.
// `deadline` is a scheduling field, not lifecycle state, so it travels as its
// own argument: the patch owns the status transition, the caller owns the
// deadline math.
export function activateItemWithDeadlinePatch(deadline: string | null) {
  return { status: "active", deadline };
}

export function restoreItemPatch(status: RestorableItemStatus = "active") {
  return { status, deleted_at: null };
}

// INFRA-19: undo of a triage action restores the task's previously-captured
// status + deadline. Captured before the action; restored as a single patch
// rather than a hand-written object.
// `status` is typed loose on purpose: it re-applies a previously-captured
// row value (which may be `null` or an unknown legacy value), and Postgres'
// CHECK constraint is the final authority on what's valid.
export function revertItemPatch(status: string | null, deadline: string | null) {
  return { status, deadline };
}

export function moveItemToTrashPatch(now = new Date()) {
  return { status: "deleted", deleted_at: now.toISOString() };
}

// INFRA-19: status on a brand-new task is always `active` — never hand-write
// it at the call site; route the whole insert payload through this helper so
// `grep` stays the single source of truth for what a new task's status is.
// Generic so the full Insert shape (required title/user_id etc.) is preserved.
export function newTaskInsert<T extends Record<string, unknown>>(payload: T) {
  return { ...payload, status: "active" as const };
}

export function permanentlyDeleteFilter(id: string) {
  return { id };
}
