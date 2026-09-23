import { describe, it, expect } from "vitest";
import { formatRRule } from "@/lib/utils";

describe("formatRRule", () => {
  it.each([
    ["FREQ=DAILY", "Every day"],
    ["FREQ=DAILY;INTERVAL=2", "Every other day"],
    ["FREQ=WEEKLY", "Every week"],
    ["FREQ=WEEKLY;INTERVAL=2", "Every other week"],
    ["FREQ=WEEKLY;INTERVAL=3", "Every 3 weeks"],
    ["FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "Every weekday"],
    ["FREQ=WEEKLY;BYDAY=SA,SU", "Every weekend"],
    ["FREQ=WEEKLY;BYDAY=MO,TH", "Every Mon & Thu"],
    ["FREQ=MONTHLY", "Every month"],
    ["FREQ=MONTHLY;BYMONTHDAY=1", "Every month on the 1st"],
    ["FREQ=MONTHLY;BYMONTHDAY=22", "Every month on the 22nd"],
    ["FREQ=MONTHLY;INTERVAL=3", "Every 3 months"],
    ["FREQ=YEARLY", "Every year"],
    ["FREQ=YEARLY;INTERVAL=2", "Every 2 years"],
  ])("%s → %s", (rrule, label) => {
    expect(formatRRule(rrule)).toBe(label);
  });
});
