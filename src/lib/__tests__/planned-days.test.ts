import { describe, expect, it } from "vitest";
import { daysPlannedInLastWeek } from "@/lib/planned-days";

// Thursday 24 Sep 2026.
const today = new Date(2026, 8, 24, 9, 0);

describe("daysPlannedInLastWeek", () => {
  it("counts planned days in the 7 days ending today", () => {
    expect(
      daysPlannedInLastWeek(
        ["2026-09-24", "2026-09-23", "2026-09-21", "2026-09-18"],
        today,
      ),
    ).toBe(4);
  });

  it("does not reset after a missed day, unlike a streak", () => {
    // Every day except yesterday: a streak would read 1, this reads 6.
    expect(
      daysPlannedInLastWeek(
        [
          "2026-09-24",
          "2026-09-22",
          "2026-09-21",
          "2026-09-20",
          "2026-09-19",
          "2026-09-18",
        ],
        today,
      ),
    ).toBe(6);
  });

  it("ignores days outside the window and duplicates", () => {
    expect(
      daysPlannedInLastWeek(
        ["2026-09-17", "2026-09-10", "2026-09-24", "2026-09-24"],
        today,
      ),
    ).toBe(1);
  });

  it("is 0 with no plans", () => {
    expect(daysPlannedInLastWeek([], today)).toBe(0);
  });
});
