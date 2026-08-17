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

/* BUG-16 (Aug 17, 2026) — the sidebar ritual row's display mapping depends
   on these reason-to-state correspondences, so they live next to the engine. */
const sidebarStateFrom = (
  input: Parameters<typeof getRitualDecision>[0],
): "morning" | "evening" | "done" | "all_done" => {
  const reason = getRitualDecision(input).reason;
  if (reason === "evening_due") return "evening";
  if (reason === "morning_due") return "morning";
  if (reason === "evening_completed") return "all_done";
  return "done";
};

describe("sidebar ritual display mapping (BUG-16)", () => {
  const base = { nudgeTime: "09:00", shutdownTime: "17:00" };

  test("before nudge time reads done (muted hint), not morning", () => {
    expect(
      sidebarStateFrom({ ...base, now: new Date("2026-07-03T08:30:00") }),
    ).toBe("done");
  });

  test("evening at shutdown with morning done is not hidden by an old inline state machine", () => {
    expect(
      sidebarStateFrom({
        ...base,
        lastMorningDate: "2026-07-03",
        now: new Date("2026-07-03T17:05:00"),
      }),
    ).toBe("evening");
  });

  test("missed morning at 16:30 reads done, never the old wrong evening", () => {
    expect(
      sidebarStateFrom({ ...base, now: new Date("2026-07-03T16:30:00") }),
    ).toBe("done");
  });

  test("both done reads all_done", () => {
    expect(
      sidebarStateFrom({
        ...base,
        lastMorningDate: "2026-07-03",
        lastEveningDate: "2026-07-03",
        now: new Date("2026-07-03T20:00:00"),
      }),
    ).toBe("all_done");
  });
});
