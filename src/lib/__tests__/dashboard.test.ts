import { describe, it, expect } from "vitest";
import { summarizeDashboard, type DashboardRows } from "@/lib/dashboard";
import { makeTask } from "@/lib/__tests__/test-utils";

// Thursday 24 Sep 2026, 10:00 local. This week starts Monday 21 Sep.
const now = new Date(2026, 8, 24, 10, 0);
const local = (d: number, h = 12) => new Date(2026, 8, d, h).toISOString();

const rows = (over: Partial<DashboardRows> = {}): DashboardRows => ({
  tasks: [],
  inboxItems: [],
  threads: [],
  recentDone: [],
  recentSessions: [],
  ritualCompletedAt: [],
  locationsCount: 0,
  ...over,
});

describe("summarizeDashboard", () => {
  it("cuts this week and last week from the fetched history in local time", () => {
    const done = (id: string, day: number, hour = 12) =>
      makeTask({ id, status: "done", completed_at: local(day, hour) });
    const s = summarizeDashboard(
      rows({
        recentDone: [
          done("mon", 21, 0), // Monday 00:00 is this week
          done("thu", 24),
          done("lastSun", 20, 23), // Sunday 23:00 is last week
          done("lastMon", 14, 0),
          done("older", 13),
        ],
        recentSessions: [
          { completed_at: local(22), duration_minutes: 25 },
          { completed_at: local(23), duration_minutes: 50 },
          { completed_at: local(16), duration_minutes: 30 },
        ],
      }),
      now,
    );

    expect(s.doneTasks.map((t) => t.id)).toEqual(["mon", "thu"]);
    expect(s.doneTasksLastWeek.map((t) => t.id)).toEqual([
      "lastSun",
      "lastMon",
    ]);
    expect(s.dayCounts).toEqual([1, 0, 0, 1, 0, 0, 0]);
    expect(s.pomodorosThisWeek).toBe(2);
    expect(s.focusMinutesThisWeek).toBe(75);
    expect(s.focusMinutesLastWeek).toBe(30);
  });

  it("orders Up Next: overdue, urgent, high due today, then by deadline", () => {
    const s = summarizeDashboard(
      rows({
        tasks: [
          makeTask({ id: "later", priority: 3, deadline: local(28) }),
          makeTask({ id: "highToday", priority: 2, deadline: local(24, 18) }),
          makeTask({ id: "urgent", priority: 1, deadline: null }),
          makeTask({ id: "overdue", priority: 4, deadline: local(22) }),
          makeTask({ id: "none", priority: 4, deadline: null }),
          makeTask({
            id: "snoozed",
            priority: 1,
            snoozed_until: local(25),
          }),
        ],
      }),
      now,
    );
    expect(s.tasks.map((t) => t.id)).toEqual([
      "overdue",
      "urgent",
      "highToday",
      "later",
      "none",
    ]);
  });

  it("does not reorder the cached rows it was given", () => {
    const tasks = [
      makeTask({ id: "b", deadline: local(28) }),
      makeTask({ id: "a", deadline: local(25) }),
    ];
    summarizeDashboard(rows({ tasks }), now);
    expect(tasks.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
