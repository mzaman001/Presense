import { describe, expect, it } from "vitest";
import { computeRitualStreak } from "@/lib/ritualStreak";

describe("computeRitualStreak", () => {
  const today = new Date("2026-09-15T09:00:00");

  it("returns 0 when there are no completions", () => {
    expect(computeRitualStreak([], today)).toBe(0);
  });

  it("counts today as day 1 when today is completed", () => {
    expect(computeRitualStreak(["2026-09-15"], today)).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    expect(
      computeRitualStreak(["2026-09-13", "2026-09-14", "2026-09-15"], today),
    ).toBe(3);
  });

  it("still counts the streak through yesterday when today isn't done yet", () => {
    expect(computeRitualStreak(["2026-09-13", "2026-09-14"], today)).toBe(2);
  });

  it("stops at the first gap", () => {
    expect(
      computeRitualStreak(["2026-09-10", "2026-09-14", "2026-09-15"], today),
    ).toBe(2);
  });

  it("returns 0 when the most recent completion is more than a day before today", () => {
    expect(computeRitualStreak(["2026-09-10"], today)).toBe(0);
  });

  it("deduplicates repeated date entries without inflating the count", () => {
    expect(
      computeRitualStreak(["2026-09-15", "2026-09-15", "2026-09-14"], today),
    ).toBe(2);
  });

  it("ignores unsorted input", () => {
    expect(
      computeRitualStreak(["2026-09-15", "2026-09-13", "2026-09-14"], today),
    ).toBe(3);
  });
});
