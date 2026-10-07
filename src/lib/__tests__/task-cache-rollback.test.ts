import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  removeTaskFromCaches,
  updateTaskInCaches,
  insertNewTaskIntoCaches,
  type TaskRecord,
} from "@/lib/task-cache";
import { makeTask } from "@/lib/__tests__/test-utils";

// Rolling back a failed optimistic edit used to restore a snapshot of the
// whole cache, taken before that edit: any other edit made since (and still
// valid) vanished from the screen until the next refetch.
function setup() {
  const qc = new QueryClient();
  const a = makeTask({ id: "a", title: "A" });
  const b = makeTask({ id: "b", title: "B" });
  const c = makeTask({ id: "c", title: "C" });
  qc.setQueryData<TaskRecord[]>(["tasks"], [a, b, c]);
  qc.setQueryData(["dashboard"], { tasks: [a, b, c], other: 1 });
  return qc;
}
const ids = (qc: QueryClient) =>
  qc.getQueryData<TaskRecord[]>(["tasks"])!.map((t) => `${t.id}:${t.title}`);
const dashIds = (qc: QueryClient) =>
  qc
    .getQueryData<{ tasks: TaskRecord[] }>(["dashboard"])!
    .tasks.map((t) => `${t.id}:${t.title}`);

describe("optimistic rollback", () => {
  it("undoes only its own change, keeping a later edit", () => {
    const qc = setup();
    const rollbackRemove = removeTaskFromCaches(qc, "a");
    updateTaskInCaches(qc, "c", { title: "C2" });
    rollbackRemove();
    expect(ids(qc)).toEqual(["a:A", "b:B", "c:C2"]);
    expect(dashIds(qc)).toEqual(["a:A", "b:B", "c:C2"]);
  });

  it("restores a row's own previous values, not others'", () => {
    const qc = setup();
    const rollbackEdit = updateTaskInCaches(qc, "a", { title: "A2" });
    removeTaskFromCaches(qc, "b");
    rollbackEdit();
    expect(ids(qc)).toEqual(["a:A", "c:C"]);
  });

  it("removes an optimistic insert without touching other edits", () => {
    const qc = setup();
    const rollbackInsert = insertNewTaskIntoCaches(
      qc,
      makeTask({ id: "n", title: "New" }),
    );
    updateTaskInCaches(qc, "b", { title: "B2" });
    rollbackInsert();
    expect(ids(qc)).toEqual(["a:A", "b:B2", "c:C"]);
    expect(dashIds(qc)).toEqual(["a:A", "b:B2", "c:C"]);
  });
});
