import { describe, it, expect, beforeEach } from "vitest";
import { claimSessionLog } from "@/lib/focus-timer";

// Every open tab restores the same saved timer, so each one finished the
// session and logged it: one 25-minute session counted twice. The first tab
// to finish claims the log; the others see it and skip.
describe("claimSessionLog", () => {
  beforeEach(() => localStorage.clear());
  const end = 1_791_400_000_000;

  it("lets the first tab log a session and not a second one", () => {
    expect(claimSessionLog("work", end)).toBe(true);
    // Another tab, a fraction of a second later, same session.
    expect(claimSessionLog("work", end + 700)).toBe(false);
  });

  it("still logs the next session", () => {
    expect(claimSessionLog("work", end)).toBe(true);
    expect(claimSessionLog("short_break", end + 5 * 60_000)).toBe(true);
    expect(claimSessionLog("work", end + 30 * 60_000)).toBe(true);
  });
});
