import { describe, it, expect } from "vitest";
import { nextOccurrence } from "../../../supabase/functions/cron_recurrence/next-occurrence";

// Instants are written in UTC; "2026-09-23 21:00" means 21:00Z.
const utc = (s: string) => new Date(`${s.replace(" ", "T")}:00Z`);
const show = (d: Date | null) =>
  d?.toISOString().slice(0, 16).replace("T", " ");
const NINE = { hour: 9, minute: 0 };

function next(
  rrule: string,
  completed: string,
  deadline: string | null,
  timeZone = "UTC",
) {
  return show(
    nextOccurrence({
      rrule,
      completedAt: utc(completed),
      previousDeadline: deadline ? utc(deadline) : null,
      timeZone,
      fallbackTime: NINE,
    }),
  );
}

describe("nextOccurrence: daily", () => {
  it.each([
    // [rrule, completed, due, next]
    ["FREQ=DAILY", "2026-09-23 15:00", "2026-09-23 21:00", "2026-09-24 21:00"],
    [
      "FREQ=DAILY;INTERVAL=3",
      "2026-09-23 15:00",
      "2026-09-23 21:00",
      "2026-09-26 21:00",
    ],
    // five days late: the next one after today, not five in a row
    ["FREQ=DAILY", "2026-09-23 15:00", "2026-09-18 21:00", "2026-09-24 21:00"],
    // late with an interval: stays on the every-3-days beat
    [
      "FREQ=DAILY;INTERVAL=3",
      "2026-09-23 15:00",
      "2026-09-18 21:00",
      "2026-09-24 21:00",
    ],
    // done early: after the day it was due
    ["FREQ=DAILY", "2026-09-23 15:00", "2026-09-25 21:00", "2026-09-26 21:00"],
  ])("%s done %s, due %s → %s", (rrule, completed, due, want) => {
    expect(next(rrule, completed, due)).toBe(want);
  });

  it("uses the fallback time when the task had no due date", () => {
    expect(next("FREQ=DAILY", "2026-09-23 15:00", null)).toBe(
      "2026-09-24 09:00",
    );
  });
});

describe("nextOccurrence: weekly", () => {
  it.each([
    // plain weekly keeps the due date's weekday (Wed)
    ["FREQ=WEEKLY", "2026-09-23 15:00", "2026-09-23 21:00", "2026-09-30 21:00"],
    [
      "FREQ=WEEKLY;INTERVAL=2",
      "2026-09-23 15:00",
      "2026-09-23 21:00",
      "2026-10-07 21:00",
    ],
    // Mon & Thu: Mon → Thu → Mon
    [
      "FREQ=WEEKLY;BYDAY=MO,TH",
      "2026-09-21 12:00",
      "2026-09-21 18:00",
      "2026-09-24 18:00",
    ],
    [
      "FREQ=WEEKLY;BYDAY=MO,TH",
      "2026-09-24 12:00",
      "2026-09-24 18:00",
      "2026-09-28 18:00",
    ],
    // Monday's task done early on Saturday: not that same Monday again
    [
      "FREQ=WEEKLY;BYDAY=MO",
      "2026-09-19 12:00",
      "2026-09-21 18:00",
      "2026-09-28 18:00",
    ],
    // every other Tuesday, done a day early: skips a week
    [
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
      "2026-09-21 12:00",
      "2026-09-22 18:00",
      "2026-10-06 18:00",
    ],
    // every other week on Tue & Thu: both days in the active week
    [
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH",
      "2026-09-22 12:00",
      "2026-09-22 18:00",
      "2026-09-24 18:00",
    ],
    [
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH",
      "2026-09-24 12:00",
      "2026-09-24 18:00",
      "2026-10-06 18:00",
    ],
    // every other Tuesday done a week late keeps its fortnights
    [
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
      "2026-09-29 12:00",
      "2026-09-22 18:00",
      "2026-10-06 18:00",
    ],
  ])("%s done %s, due %s → %s", (rrule, completed, due, want) => {
    expect(next(rrule, completed, due)).toBe(want);
  });
});

describe("nextOccurrence: monthly", () => {
  it.each([
    // the reported bug: done on the 3rd, back on the 1st
    [
      "FREQ=MONTHLY;BYMONTHDAY=1",
      "2026-09-03 12:00",
      "2026-09-01 23:59",
      "2026-10-01 23:59",
    ],
    // no 31st in September: skipped, like the parser's firstOccurrence
    [
      "FREQ=MONTHLY;BYMONTHDAY=31",
      "2026-08-31 12:00",
      "2026-08-31 23:59",
      "2026-10-31 23:59",
    ],
    // plain monthly keeps the due date's day, skipping February
    [
      "FREQ=MONTHLY",
      "2026-01-31 12:00",
      "2026-01-31 23:59",
      "2026-03-31 23:59",
    ],
    [
      "FREQ=MONTHLY;INTERVAL=3",
      "2026-01-15 12:00",
      "2026-01-15 23:59",
      "2026-04-15 23:59",
    ],
    [
      "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=31",
      "2026-01-31 12:00",
      "2026-01-31 23:59",
      "2026-03-31 23:59",
    ],
    // over the year end
    [
      "FREQ=MONTHLY;BYMONTHDAY=5",
      "2026-12-05 12:00",
      "2026-12-05 23:59",
      "2027-01-05 23:59",
    ],
    // years overdue: the next one after today, found without a long walk
    [
      "FREQ=MONTHLY",
      "2026-09-23 12:00",
      "2020-01-15 23:59",
      "2026-10-15 23:59",
    ],
  ])("%s done %s, due %s → %s", (rrule, completed, due, want) => {
    expect(next(rrule, completed, due)).toBe(want);
  });

  it("picks the next such day after completion when there was no due date", () => {
    expect(next("FREQ=MONTHLY;BYMONTHDAY=1", "2026-09-23 15:00", null)).toBe(
      "2026-10-01 09:00",
    );
  });
});

describe("nextOccurrence: yearly", () => {
  it.each([
    ["FREQ=YEARLY", "2027-01-01 12:00", "2027-01-01 23:59", "2028-01-01 23:59"],
    [
      "FREQ=YEARLY;INTERVAL=2",
      "2027-01-01 12:00",
      "2027-01-01 23:59",
      "2029-01-01 23:59",
    ],
    // 29 February waits for the next leap year
    ["FREQ=YEARLY", "2028-02-29 12:00", "2028-02-29 23:59", "2032-02-29 23:59"],
  ])("%s done %s, due %s → %s", (rrule, completed, due, want) => {
    expect(next(rrule, completed, due)).toBe(want);
  });

  it("repeats on the completion date when there was no due date", () => {
    expect(next("FREQ=YEARLY", "2026-09-23 15:00", null)).toBe(
      "2027-09-23 09:00",
    );
  });
});

describe("nextOccurrence: time zones", () => {
  it("keeps 9pm local across the clocks going back", () => {
    // 21:00 BST on Sat 24 Oct is 20:00Z; after the change 21:00 GMT is 21:00Z.
    expect(
      next(
        "FREQ=DAILY",
        "2026-10-24 19:00",
        "2026-10-24 20:00",
        "Europe/London",
      ),
    ).toBe("2026-10-25 21:00");
  });

  it("uses the user's calendar day, not UTC's", () => {
    // Due 23:59 on 23 Sep in New York (03:59Z on the 24th), done at 22:00
    // local on the 23rd (02:00Z on the 24th): next is the 24th local.
    expect(
      next(
        "FREQ=DAILY",
        "2026-09-24 02:00",
        "2026-09-24 03:59",
        "America/New_York",
      ),
    ).toBe("2026-09-25 03:59");
  });

  it("puts the fallback time in the user's zone", () => {
    // 09:00 BST is 08:00Z.
    expect(next("FREQ=DAILY", "2026-09-23 10:00", null, "Europe/London")).toBe(
      "2026-09-24 08:00",
    );
  });

  it("falls back to UTC for a missing or invalid zone", () => {
    expect(next("FREQ=DAILY", "2026-09-23 10:00", null, "Not/AZone")).toBe(
      "2026-09-24 09:00",
    );
    expect(
      show(
        nextOccurrence({
          rrule: "FREQ=DAILY",
          completedAt: utc("2026-09-23 10:00"),
          previousDeadline: null,
          timeZone: null,
          fallbackTime: NINE,
        }),
      ),
    ).toBe("2026-09-24 09:00");
  });
});

describe("nextOccurrence: shapes it can't read", () => {
  it.each(["", "FREQ=HOURLY;INTERVAL=8", "RRULE:garbage"])(
    "returns null for %j",
    (rrule) => {
      expect(next(rrule, "2026-09-23 10:00", null)).toBeUndefined();
    },
  );
});
