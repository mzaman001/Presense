import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { insertNewTaskIntoCaches, type TaskRecord } from "@/lib/task-cache";
import { makeTask } from "@/lib/__tests__/test-utils";

const task = (id: string, priority: number | null, deadline: string | null) =>
  makeTask({ id, priority, deadline });

describe("insertNewTaskIntoCaches", () => {
  it("places the task where fetchActiveTasks' order would, so it doesn't jump", () => {
    const qc = new QueryClient();
    qc.setQueryData<TaskRecord[]>(
      ["tasks"],
      [
        task("a", 1, "2026-09-25T10:00:00Z"),
        task("b", 2, "2026-09-24T10:00:00Z"),
        task("c", 2, null),
        task("d", null, null),
      ],
    );

    insertNewTaskIntoCaches(qc, task("new", 2, "2026-09-26T10:00:00Z"));

    expect(qc.getQueryData<TaskRecord[]>(["tasks"])!.map((t) => t.id)).toEqual([
      "a",
      "b",
      "new",
      "c",
      "d",
    ]);
  });

  it("leaves the inbox list alone and rolls every cache back", () => {
    const qc = new QueryClient();
    const tasks = [task("a", 1, null)];
    const inbox = [task("i", null, null)];
    qc.setQueryData(["tasks"], tasks);
    qc.setQueryData(["inbox-tasks"], inbox);
    qc.setQueryData(["dashboard"], { tasks, streak: 3 });

    const rollback = insertNewTaskIntoCaches(qc, task("new", 1, null));
    expect(qc.getQueryData(["inbox-tasks"])).toBe(inbox);
    expect(
      qc.getQueryData<{ tasks: TaskRecord[] }>(["dashboard"])!.tasks,
    ).toHaveLength(2);

    rollback();
    expect(qc.getQueryData(["tasks"])).toEqual(tasks);
    expect(qc.getQueryData(["dashboard"])).toEqual({ tasks, streak: 3 });
  });

  it("does nothing to a list that was never loaded", () => {
    const qc = new QueryClient();
    insertNewTaskIntoCaches(qc, task("new", 1, null));
    expect(qc.getQueryData(["tasks"])).toBeUndefined();
  });
});
