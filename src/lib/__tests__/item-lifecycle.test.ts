import { describe, expect, test } from "vitest";
import { archiveItemPatch, moveItemToTrashPatch, restoreItemPatch } from "@/lib/item-lifecycle";

describe("item lifecycle patches", () => {
  test("archive is reversible and does not set deleted_at", () => {
    expect(archiveItemPatch()).toEqual({ status: "archived", deleted_at: null });
  });

  test("delete means move to trash with deleted_at", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    expect(moveItemToTrashPatch(now)).toEqual({
      status: "deleted",
      deleted_at: "2026-07-03T12:00:00.000Z",
    });
  });

  test("restore clears deleted_at and returns to active by default", () => {
    expect(restoreItemPatch()).toEqual({ status: "active", deleted_at: null });
    expect(restoreItemPatch("inbox")).toEqual({ status: "inbox", deleted_at: null });
  });
});
