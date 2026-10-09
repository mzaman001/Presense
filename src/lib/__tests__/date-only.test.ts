import { describe, it, expect } from "vitest";
import { dateOnlyDeadline } from "@/lib/date-only";

describe("dateOnlyDeadline", () => {
  it("is the end of that day, so the task isn't overdue all day", () => {
    const d = dateOnlyDeadline(new Date(2026, 9, 9, 0, 0));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([9, 23, 59]);
  });
});

describe("isDateOnly", () => {
  it("knows both the date-only time and the calendar's old midnight", async () => {
    const { isDateOnly } = await import("@/lib/date-only");
    expect(isDateOnly(new Date(2026, 9, 9, 23, 59))).toBe(true);
    expect(isDateOnly(new Date(2026, 9, 9, 0, 0))).toBe(true);
    expect(isDateOnly(new Date(2026, 9, 9, 9, 30))).toBe(false);
  });
});
