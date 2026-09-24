import { beforeEach, describe, expect, it } from "vitest";
import {
  cleanOnboardingPatch,
  endFirstRun,
  formatClock,
  fromDbTime,
  isFirstRun,
  loadOnboardingStep,
  saveOnboardingStep,
  startFirstRun,
  toDbTime,
} from "@/lib/first-run";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("first run", () => {
  it("is off until onboarding starts it", () => {
    expect(isFirstRun()).toBe(false);
    startFirstRun();
    expect(isFirstRun()).toBe(true);
  });

  it("ends once the first plan is done, skipped or closed", () => {
    startFirstRun();
    endFirstRun();
    expect(isFirstRun()).toBe(false);
  });
});

describe("onboarding step", () => {
  it("resumes the saved step and ignores anything out of range", () => {
    expect(loadOnboardingStep(7)).toBe(1);
    saveOnboardingStep(4);
    expect(loadOnboardingStep(7)).toBe(4);
    saveOnboardingStep(9);
    expect(loadOnboardingStep(7)).toBe(1);
    saveOnboardingStep(null);
    expect(loadOnboardingStep(7)).toBe(1);
  });
});

describe("times", () => {
  it("saves the time exactly as chosen, with no offset", () => {
    expect(toDbTime("08:00")).toBe("08:00:00");
    expect(toDbTime("23:45")).toBe("23:45:00");
  });

  it("reads a saved time back, or falls back", () => {
    expect(fromDbTime("07:30:00", "08:00")).toBe("07:30");
    expect(fromDbTime(null, "08:00")).toBe("08:00");
  });

  it("formats a clock time for display", () => {
    expect(formatClock("18:00")).toMatch(/6:00|18:00/);
  });
});

describe("cleanOnboardingPatch", () => {
  it("keeps valid onboarding fields, trimmed", () => {
    expect(
      cleanOnboardingPatch({
        display_name: "  Sam ",
        color_mode: "system",
        nudge_time: "08:00:00",
        daily_capacity_minutes: 240,
        onboarding_complete: true,
      }),
    ).toEqual({
      display_name: "Sam",
      color_mode: "system",
      nudge_time: "08:00:00",
      daily_capacity_minutes: 240,
      onboarding_complete: true,
    });
  });

  it.each([
    [{ display_name: "   " }],
    [{ color_mode: "neon" }],
    [{ nudge_time: "25:00:00" }],
    [{ daily_capacity_minutes: 999 }],
    [{ onboarding_complete: false }],
    // Anything onboarding doesn't set is refused outright.
    [{ user_id: "someone-else" }],
    [{ display_name: "Sam", ollama_url: "http://evil" }],
    [{}],
    [null],
  ])("refuses %j", (input) => {
    expect(cleanOnboardingPatch(input)).toBeNull();
  });
});
