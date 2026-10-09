import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  dateKeyIn,
  formatClockTime,
  formatShortDate,
  formatWeekdayDate,
  isValidTimeZone,
} from "@/lib/zoned-date";

describe("dateKeyIn", () => {
  it("gives the calendar date in the zone, not the machine's", () => {
    const instant = new Date("2026-10-05T20:30:00Z");
    expect(dateKeyIn(instant, "UTC")).toBe("2026-10-05");
    expect(dateKeyIn(instant, "Asia/Kolkata")).toBe("2026-10-06"); // 02:00 next day
    expect(dateKeyIn(instant, "America/Los_Angeles")).toBe("2026-10-05");
  });

  it("handles a DST change day", () => {
    // New York leaves DST on 2026-11-01 at 02:00 local (06:00Z).
    expect(
      dateKeyIn(new Date("2026-11-01T03:59:00Z"), "America/New_York"),
    ).toBe("2026-10-31");
    expect(
      dateKeyIn(new Date("2026-11-01T04:00:00Z"), "America/New_York"),
    ).toBe("2026-11-01");
  });
});

describe("addDaysKey", () => {
  it("steps across month and year ends", () => {
    expect(addDaysKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("formatters", () => {
  const instant = new Date("2026-10-05T20:30:00Z");

  it("format in the zone with a fixed en-US locale", () => {
    expect(formatShortDate(instant, "Asia/Kolkata")).toBe("Oct 6");
    expect(formatShortDate(instant, "UTC")).toBe("Oct 5");
    expect(formatClockTime(instant, "Asia/Kolkata")).toBe("2:00 AM");
    expect(formatClockTime(instant, "UTC")).toBe("8:30 PM");
    expect(formatWeekdayDate(instant, "UTC")).toBe("Mon, Oct 5");
  });
});

describe("an unknown timezone", () => {
  // A bad saved zone used to throw RangeError from Intl and break the
  // server-rendered Do list. It now reads as UTC.
  it("is reported invalid", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Etc/Unknown")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it("formats as UTC instead of throwing", () => {
    const at = new Date("2026-10-07T23:30:00Z");
    expect(dateKeyIn(at, "Not/AZone")).toBe(dateKeyIn(at, "UTC"));
    expect(formatClockTime(at, "Etc/Unknown")).toBe(formatClockTime(at, "UTC"));
  });
});
