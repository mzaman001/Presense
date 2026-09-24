import { describe, expect, it } from "vitest";
import {
  freshStartPatch,
  isStuck,
  keepAsIsPatch,
  notNowPatch,
} from "@/lib/stuck-tasks";

const now = Date.parse("2026-09-25T10:00:00Z");
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const task = (over: Partial<Parameters<typeof isStuck>[0]> = {}) => ({
  status: "active",
  defer_count: 0,
  first_deferred_at: null,
  stuck_dismissed_until: null,
  ...over,
});

describe("isStuck", () => {
  it("treats two snoozes in one afternoon as juggling, not avoidance", () => {
    expect(
      isStuck(task({ defer_count: 2, first_deferred_at: hoursAgo(3) }), now),
    ).toBe(false);
  });

  it("counts two deferrals spanning 48 hours", () => {
    expect(
      isStuck(task({ defer_count: 2, first_deferred_at: hoursAgo(49) }), now),
    ).toBe(true);
  });

  it("counts three deferrals in any window", () => {
    expect(
      isStuck(task({ defer_count: 3, first_deferred_at: hoursAgo(2) }), now),
    ).toBe(true);
  });

  it("stays quiet while dismissed", () => {
    expect(
      isStuck(
        task({
          defer_count: 5,
          first_deferred_at: hoursAgo(100),
          stuck_dismissed_until: new Date(now + 3_600_000).toISOString(),
        }),
        now,
      ),
    ).toBe(false);
  });

  it("ignores finished or inbox tasks", () => {
    expect(isStuck(task({ status: "done", defer_count: 9 }), now)).toBe(false);
    expect(isStuck(task({ status: "inbox", defer_count: 9 }), now)).toBe(false);
  });
});

describe("backing off", () => {
  it("'Not now' waits a day, then a week after the second time", () => {
    const first = notNowPatch({ stuck_dismissals: 0 }, now);
    expect(first.stuck_dismissals).toBe(1);
    expect(Date.parse(first.stuck_dismissed_until) - now).toBe(86_400_000);

    const second = notNowPatch({ stuck_dismissals: 1 }, now);
    expect(Date.parse(second.stuck_dismissed_until) - now).toBe(7 * 86_400_000);
  });

  it("'Keep as is' starts fresh and stays quiet for a week", () => {
    const patch = keepAsIsPatch(now);
    expect(patch).toMatchObject({ defer_count: 0, first_deferred_at: null });
    expect(Date.parse(patch.stuck_dismissed_until) - now).toBe(7 * 86_400_000);
  });

  it("a fix gives the task a fresh start", () => {
    expect(freshStartPatch()).toEqual({
      defer_count: 0,
      first_deferred_at: null,
      stuck_dismissals: 0,
      stuck_dismissed_until: null,
    });
  });
});
