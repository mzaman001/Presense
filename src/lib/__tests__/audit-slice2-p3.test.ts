import { describe, it, expect, beforeEach } from "vitest";
import { reminderPresets } from "@/lib/reminder-times";
import { getRitualDecision } from "@/lib/rituals";
import { loadFocusTimer } from "@/lib/focus-timer";
import { formatRRule } from "@/lib/utils";
import {
  markMutation,
  resetMutationTracking,
  trackedRowCount,
} from "@/lib/mutation-tracking";
import { rowsForCapture } from "@/lib/capture-outbox";

describe("Tomorrow morning in the small hours", () => {
  it("means the coming morning when it's past midnight", () => {
    const now = new Date(2026, 9, 8, 0, 30); // 00:30
    const morning = reminderPresets(now, { nudge_time: "10:00" }).find(
      (p) => p.id === "morning",
    )!;
    expect(morning.at.getDate()).toBe(8);
    expect(morning.at.getHours()).toBe(10);
  });

  it("still means the next day during the day", () => {
    const now = new Date(2026, 9, 8, 14, 0);
    const morning = reminderPresets(now, { nudge_time: "10:00" }).find(
      (p) => p.id === "morning",
    )!;
    expect(morning.at.getDate()).toBe(9);
  });
});

describe("default ritual times", () => {
  // The database defaults (and the server's reminders) are 10:00 / 18:00;
  // the client assumed 09:00 / 17:00 for a row without them.
  it("match the server's when unset", () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 7, h, m);
    expect(getRitualDecision({ now: at(9, 30) }).reason).toBe(
      "before_morning_window",
    );
    expect(getRitualDecision({ now: at(10, 5) }).kind).toBe("morning");
    expect(
      getRitualDecision({ now: at(17, 30), lastMorningDate: "2026-10-07" })
        .kind,
    ).toBe("none");
    expect(
      getRitualDecision({ now: at(18, 5), lastMorningDate: "2026-10-07" }).kind,
    ).toBe("evening");
  });
});

describe("loadFocusTimer", () => {
  beforeEach(() => localStorage.clear());
  it("drops a saved state that isn't a timer", () => {
    localStorage.setItem(
      "pomodoro_state",
      JSON.stringify({ phase: "nap", startedAt: "soon", duration: null }),
    );
    expect(loadFocusTimer()).toBeNull();
  });
  it("keeps a valid one", () => {
    const state = {
      taskId: null,
      taskTitle: "Write",
      phase: "work",
      sessionCount: 1,
      startedAt: 1_700_000_000_000,
      duration: 1500,
    };
    localStorage.setItem("pomodoro_state", JSON.stringify(state));
    expect(loadFocusTimer()).toEqual(state);
  });
});

describe("formatRRule", () => {
  it("keeps the day for a multi-month rule", () => {
    expect(formatRRule("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15")).toBe(
      "Every 2 months on the 15th",
    );
  });
});

describe("echo tracking", () => {
  it("forgets row writes once they're long past", () => {
    resetMutationTracking();
    const t0 = Date.now();
    markMutation("items", ["a", "b"], t0);
    markMutation("items", ["c"], t0 + 120_000);
    expect(trackedRowCount("items")).toBe(1);
  });
});

describe("capture rows", () => {
  it("still files inbox and Do captures under their statuses", () => {
    const rows = rowsForCapture("u", [
      { title: "a", destinationId: "inbox" },
      { title: "b", destinationId: "do" },
    ] as never);
    expect(rows.map((r) => r.row.status)).toEqual(["inbox", "active"]);
  });
});
