import { describe, it, expect } from "vitest";
import { detectRecurrence, parseTaskText } from "@/lib/nlp/parse-task-text";

describe("detectRecurrence", () => {
  it.each([
    // daily
    ["Do the work everyday", "FREQ=DAILY"],
    ["Do the work every day", "FREQ=DAILY"],
    ["Stretch each day", "FREQ=DAILY"],
    ["Stretch daily", "FREQ=DAILY"],
    ["Journal every night", "FREQ=DAILY"],
    ["Walk every morning", "FREQ=DAILY"],
    ["Every other day water plants", "FREQ=DAILY;INTERVAL=2"],
    ["Back up every 3 days", "FREQ=DAILY;INTERVAL=3"],
    // weekly
    ["Review everyweek", "FREQ=WEEKLY"],
    ["Review every week", "FREQ=WEEKLY"],
    ["Review weekly", "FREQ=WEEKLY"],
    ["Standup every weekday", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"],
    ["Standup on weekdays", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"],
    ["Hike every weekend", "FREQ=WEEKLY;BYDAY=SA,SU"],
    ["Gym every monday", "FREQ=WEEKLY;BYDAY=MO"],
    ["Gym every mon", "FREQ=WEEKLY;BYDAY=MO"],
    ["Gym each Monday", "FREQ=WEEKLY;BYDAY=MO"],
    ["Gym on mondays", "FREQ=WEEKLY;BYDAY=MO"],
    ["Gym every mon and thu", "FREQ=WEEKLY;BYDAY=MO,TH"],
    ["Gym every tues, thurs & sat", "FREQ=WEEKLY;BYDAY=TU,TH,SA"],
    ["Clean every other week", "FREQ=WEEKLY;INTERVAL=2"],
    ["Clean fortnightly", "FREQ=WEEKLY;INTERVAL=2"],
    ["Clean biweekly", "FREQ=WEEKLY;INTERVAL=2"],
    ["Call mom every 2 weeks", "FREQ=WEEKLY;INTERVAL=2"],
    // monthly
    ["Pay rent every month", "FREQ=MONTHLY"],
    ["Pay rent everymonth", "FREQ=MONTHLY"],
    ["Pay rent monthly", "FREQ=MONTHLY"],
    ["Pay rent every month on the 1st", "FREQ=MONTHLY;BYMONTHDAY=1"],
    ["Pay rent on the 15th of every month", "FREQ=MONTHLY;BYMONTHDAY=15"],
    ["Pay rent every 1st", "FREQ=MONTHLY;BYMONTHDAY=1"],
    ["Invoice every 3 months", "FREQ=MONTHLY;INTERVAL=3"],
    // yearly
    ["Renew passport every year", "FREQ=YEARLY"],
    ["Renew passport yearly", "FREQ=YEARLY"],
    ["Renew passport annually", "FREQ=YEARLY"],
  ])("%s → %s", (text, rrule) => {
    expect(detectRecurrence(text)?.rrule).toBe(rrule);
  });

  it.each([
    "Pay rent on the 1st",
    "Buy a month pass",
    "Everyone meeting tomorrow",
    "Read the Monday report",
    "Weekend plans",
  ])("finds no repeat in %s", (text) => {
    expect(detectRecurrence(text)).toBeNull();
  });
});

describe("parseTaskText", () => {
  // Wednesday 23 Sep 2026, 10:00 local.
  const now = new Date(2026, 8, 23, 10, 0);

  it("reads the screenshot case: repeat + time, and cleans the title", async () => {
    const r = await parseTaskText("Everyday 9pm Do the Work", { now });
    expect(r.recurrence).toBe("FREQ=DAILY");
    expect(r.title).toBe("Do the Work");
    expect(r.deadline?.getHours()).toBe(21);
    // 9pm today is still ahead of 10:00, so the first one is today.
    expect(r.deadline?.getDate()).toBe(23);
  });

  it("starts a weekday repeat on the next matching day", async () => {
    const r = await parseTaskText("Gym every monday at 7am", { now });
    expect(r.recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(r.title).toBe("Gym");
    expect(r.deadline?.getDay()).toBe(1);
    expect(r.deadline?.getDate()).toBe(28);
    expect(r.deadline?.getHours()).toBe(7);
  });

  it("uses the repeat's own time for every morning / every night", async () => {
    const r = await parseTaskText("Journal every night", { now });
    expect(r.recurrence).toBe("FREQ=DAILY");
    expect(r.deadline?.getHours()).toBe(21);
    expect(r.title).toBe("Journal");
  });

  it("starts a monthly day-of-month repeat on the next such day", async () => {
    const r = await parseTaskText("Pay rent every month on the 1st", { now });
    expect(r.recurrence).toBe("FREQ=MONTHLY;BYMONTHDAY=1");
    expect(r.deadline?.getMonth()).toBe(9); // 1 October
    expect(r.deadline?.getDate()).toBe(1);
    expect(r.title).toBe("Pay rent");
  });

  it("keeps plain dates working and strips them from the title", async () => {
    const r = await parseTaskText("Call the dentist tomorrow at 10am", {
      now,
    });
    expect(r.recurrence).toBeNull();
    expect(r.deadline?.getDate()).toBe(24);
    expect(r.deadline?.getHours()).toBe(10);
    expect(r.title).toBe("Call the dentist");
  });

  it("leaves text without dates or repeats alone", async () => {
    const r = await parseTaskText("Buy milk", { now });
    expect(r).toMatchObject({
      title: "Buy milk",
      deadline: null,
      recurrence: null,
    });
  });

  it("can skip date parsing but still reads repeats", async () => {
    const r = await parseTaskText("Water plants every day at 8am", {
      now,
      parseDates: false,
    });
    expect(r.recurrence).toBe("FREQ=DAILY");
    expect(r.deadline).toBeNull();
  });
});
