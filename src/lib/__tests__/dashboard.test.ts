import { describe, it, expect } from "vitest";
import { summarizeDashboard, type DashboardRows } from "@/lib/dashboard";
import { makeTask } from "@/lib/__tests__/test-utils";

// Thursday 24 Sep 2026, 10:00 local. This week starts Monday 21 Sep.
const now = new Date(2026, 8, 24, 10, 0);
const local = (d: number, h = 12) => new Date(2026, 8, d, h).toISOString();

const rows = (over: Partial<DashboardRows> = {}): DashboardRows => ({
  tasks: [],
  inboxItems: [],
  threadsCount: 0,
  activeTasksTotal: 0,
  recentDone: [],
  recentSessions: [],
  ritualCompletedAt: [],
  locationsCount: 0,
  ...over,
});

describe("summarizeDashboard", () => {
  // Home's tiles used to count rows of capped lists: "Open Threads" counted
  // every thread (trashed and archived too, up to 100) and "Active Tasks"
  // stopped at 100.
  it("counts active tasks from the list, or the exact total once the list is capped", () => {
    const two = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    // A just-completed task has left the cached list but not yet the
    // server's total: the list (optimistic) wins.
    expect(
      summarizeDashboard(rows({ tasks: two, activeTasksTotal: 3 }), {
        now: now.getTime(),
      }).activeTasksCount,
    ).toBe(2);
    const capped = Array.from({ length: 100 }, (_, i) =>
      makeTask({ id: `t${i}` }),
    );
    expect(
      summarizeDashboard(rows({ tasks: capped, activeTasksTotal: 150 }), {
        now: now.getTime(),
      }).activeTasksCount,
    ).toBe(150);
  });

  it("passes the open thread count through", () => {
    expect(
      summarizeDashboard(rows({ threadsCount: 6 }), { now: now.getTime() })
        .threadsCount,
    ).toBe(6);
  });

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
      { now: now.getTime() },
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
      { now: now.getTime() },
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
    summarizeDashboard(rows({ tasks }), { now: now.getTime() });
    expect(tasks.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("cuts days and weeks in the given timezone, not the machine's", () => {
    // Monday 2026-09-21 20:30Z: still Monday in UTC, Tuesday 02:00 in Kolkata.
    const at = Date.parse("2026-09-21T20:30:00Z");
    const done = (id: string, iso: string) =>
      makeTask({ id, status: "done", completed_at: iso });
    const data = rows({
      recentDone: [
        // Sunday 20 Sep 20:00Z: Sunday in UTC (last week), Monday 01:30 in
        // Kolkata (this week).
        done("edge", "2026-09-20T20:00:00Z"),
        done("mon", "2026-09-21T10:00:00Z"),
      ],
      ritualCompletedAt: ["2026-09-20T20:00:00Z"],
    });
    const utc = summarizeDashboard(data, { timeZone: "UTC", now: at });
    expect(utc.doneTasks.map((t) => t.id)).toEqual(["mon"]);
    expect(utc.doneTasksLastWeek.map((t) => t.id)).toEqual(["edge"]);
    expect(utc.dayCounts).toEqual([1, 0, 0, 0, 0, 0, 0]);

    const kolkata = summarizeDashboard(data, {
      timeZone: "Asia/Kolkata",
      now: at,
    });
    expect(kolkata.doneTasks.map((t) => t.id)).toEqual(["edge", "mon"]);
    expect(kolkata.dayCounts).toEqual([2, 0, 0, 0, 0, 0, 0]);
    // The plan made at 01:30 on Monday in Kolkata is within the last 7 days
    // there; in UTC it was Sunday, also within them.
    expect(kolkata.plannedDays).toBe(1);
    expect(utc.plannedDays).toBe(1);
  });

  it("treats 'today' by the zone's calendar for urgent-today ordering", () => {
    // 2026-09-24 20:30Z = 25 Sep 02:00 in Kolkata.
    const at = Date.parse("2026-09-24T20:30:00Z");
    const data = rows({
      tasks: [
        makeTask({
          id: "utcToday",
          priority: 2,
          deadline: "2026-09-24T22:00:00Z",
        }),
        makeTask({
          id: "kolkataToday",
          priority: 2,
          deadline: "2026-09-25T12:00:00Z",
        }),
      ],
    });
    const kolkata = summarizeDashboard(data, {
      timeZone: "Asia/Kolkata",
      now: at,
    });
    // Both are due "today" in Kolkata (the 25th): deadline order.
    expect(kolkata.tasks.map((t) => t.id)).toEqual([
      "utcToday",
      "kolkataToday",
    ]);
    const utc = summarizeDashboard(data, { timeZone: "UTC", now: at });
    expect(utc.tasks.map((t) => t.id)).toEqual(["utcToday", "kolkataToday"]);
  });
});
