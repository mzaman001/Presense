import { describe, expect, it } from "vitest";
import { bucketTasks } from "@/lib/do-buckets";

type T = Parameters<typeof bucketTasks>[0][number];
const task = (id: string, extra: Partial<T> = {}): T =>
  ({
    id,
    status: "active",
    deadline: null,
    start_date: null,
    category: null,
    ...extra,
  }) as T;

// 2026-10-05 20:30 UTC = 2026-10-06 02:00 in Kolkata.
const now = Date.parse("2026-10-05T20:30:00Z");
const ids = (list: T[]) => list.map((t) => t.id);

describe("bucketTasks", () => {
  const tasks = [
    task("past", { deadline: "2026-10-05T10:00:00Z" }),
    task("later-utc-today", { deadline: "2026-10-05T23:00:00Z" }),
    task("kolkata-today", { deadline: "2026-10-06T12:00:00Z" }),
    task("next-week", { deadline: "2026-10-12T12:00:00Z" }),
    task("no-date"),
    task("not-started", { start_date: "2026-10-07T00:00:00Z" }),
    task("inbox", { status: "inbox" }),
  ];

  it("groups by the given timezone's calendar day", () => {
    const utc = bucketTasks(tasks, "all", { timeZone: "UTC", now });
    expect(ids(utc.overdue)).toEqual(["past"]);
    expect(ids(utc.today)).toEqual(["later-utc-today"]);
    expect(ids(utc.upcoming)).toEqual(["kolkata-today", "next-week"]);
    expect(ids(utc.someday)).toEqual(["no-date"]);

    const kolkata = bucketTasks(tasks, "all", {
      timeZone: "Asia/Kolkata",
      now,
    });
    // Already past in Kolkata's morning of the 6th: 23:00Z is 04:30 on the 6th.
    expect(ids(kolkata.overdue)).toEqual(["past"]);
    expect(ids(kolkata.today)).toEqual(["later-utc-today", "kolkata-today"]);
    expect(ids(kolkata.upcoming)).toEqual(["next-week"]);
  });

  it("leaves out tasks that haven't started and, under 'all', inbox items", () => {
    const all = bucketTasks(tasks, "all", { timeZone: "UTC", now });
    const every = [
      ...all.overdue,
      ...all.today,
      ...all.upcoming,
      ...all.someday,
    ];
    expect(ids(every)).not.toContain("not-started");
    expect(ids(every)).not.toContain("inbox");
  });

  it("'today' keeps only what's due by the end of today in that zone", () => {
    const k = bucketTasks(tasks, "today", { timeZone: "Asia/Kolkata", now });
    const every = [...k.overdue, ...k.today, ...k.upcoming, ...k.someday];
    expect(ids(every).sort()).toEqual([
      "kolkata-today",
      "later-utc-today",
      "past",
    ]);
  });

  it("filters by category", () => {
    const list = [
      task("a", { category: "Work" }),
      task("b", { category: "Home" }),
    ];
    const work = bucketTasks(list, "Work", { timeZone: "UTC", now });
    expect(ids(work.someday)).toEqual(["a"]);
  });
});
