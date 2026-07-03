export type RestorableItemStatus = "active" | "inbox" | "done" | "archived";

export function archiveItemPatch() {
  return { status: "archived", deleted_at: null };
}

export function restoreItemPatch(status: RestorableItemStatus = "active") {
  return { status, deleted_at: null };
}

export function moveItemToTrashPatch(now = new Date()) {
  return { status: "deleted", deleted_at: now.toISOString() };
}

export function permanentlyDeleteFilter(id: string) {
  return { id };
}
