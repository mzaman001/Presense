import { describe, expect, test } from "vitest";
import { getRitualDecision } from "@/lib/rituals";

describe("ritual decisions", () => {
  const base = {
    nudgeTime: "09:00",
    shutdownTime: "17:00",
    lastMorningDate: null,
    lastEveningDate: null,
  };

  test("does not auto-show morning before nudge time", () => {
    const decision = getRitualDecision({
      ...base,
      now: new Date("2026-07-03T08:30:00"),
    });
    expect(decision.kind).toBe("none");
    expect(decision.reason).toBe("before_morning_window");
  });

  test("auto-shows morning during the morning planning window", () => {
    const decision = getRitualDecision({
      ...base,
      now: new Date("2026-07-03T09:15:00"),
    });
    expect(decision.kind).toBe("morning");
    expect(decision.targetDate).toBe("2026-07-03");
  });

  test("does not auto-show missed morning planning in the evening", () => {
    const decision = getRitualDecision({
      ...base,
      now: new Date("2026-07-03T16:30:00"),
    });
    expect(decision.kind).toBe("none");
    expect(decision.reason).toBe("morning_window_missed");
  });

  test("auto-shows evening at shutdown time when morning is done", () => {
    const decision = getRitualDecision({
      ...base,
      lastMorningDate: "2026-07-03",
      now: new Date("2026-07-03T17:05:00"),
    });
    expect(decision.kind).toBe("evening");
    expect(decision.targetDate).toBe("2026-07-03");
  });

  test("does not auto-show evening at shutdown time when morning is not done", () => {
    const decision = getRitualDecision({
      ...base,
      now: new Date("2026-07-03T17:05:00"),
    });
    expect(decision.kind).toBe("none");
    expect(decision.reason).toBe("morning_window_missed");
  });

  test("planning after 15:00 targets tomorrow when manually opened", () => {
    const decision = getRitualDecision({
      ...base,
      now: new Date("2026-07-03T16:00:00"),
      manual: true,
    });
    expect(decision.kind).toBe("morning");
    expect(decision.targetDate).toBe("2026-07-04");
    expect(decision.reason).toBe("manual_evening_planning_for_tomorrow");
  });
});
