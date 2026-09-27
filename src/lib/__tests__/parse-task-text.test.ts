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

describe("detectRecurrence: weekday repeats with gaps and times", () => {
  it.each([
    ["Piano every other tuesday", "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"],
    ["Check oil every 2 weeks on saturday", "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA"],
    [
      "Clean every other week on mon & thu",
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH",
    ],
  ])("%s → %s", (text, rrule) => {
    expect(detectRecurrence(text)?.rrule).toBe(rrule);
  });

  it("takes the time from a part of day after the repeat", () => {
    const r = detectRecurrence("Bins out every thursday night");
    expect(r?.rrule).toBe("FREQ=WEEKLY;BYDAY=TH");
    expect(r?.time).toEqual({ hour: 21, minute: 0 });
    expect(r?.match).toBe("every thursday night");
  });
});

describe("parseTaskText: the things people actually type", () => {
  // Wednesday 23 Sep 2026, 10:00 local.
  const now = new Date(2026, 8, 23, 10, 0);
  const parse = (text: string) =>
    parseTaskText(text, { now, dateOrder: "DMY" });

  it("reads a bare 1–7 o'clock as the afternoon, today when still ahead", async () => {
    const r = await parse("remind me to call mom at 5");
    expect(r.title).toBe("Call mom");
    expect(r.deadline?.getDate()).toBe(23);
    expect(r.deadline?.getHours()).toBe(17);
  });

  it("keeps an explicit morning time", async () => {
    const r = await parse("gym at 7am");
    expect(r.deadline?.getHours()).toBe(7);
    expect(r.deadline?.getDate()).toBe(24);
  });

  it("reads a duration as an estimate, not a deadline", async () => {
    for (const [text, title, minutes] of [
      ["30 min run", "Run", 30],
      ["tidy desk 15m", "Tidy desk", 15],
      ["write report 1h30m", "Write report", 90],
      ["revise for 2 hours", "Revise", 120],
    ] as const) {
      const r = await parse(text);
      expect(r, text).toMatchObject({
        title,
        estimateMinutes: minutes,
        deadline: null,
      });
    }
  });

  it("still reads 'in 2 hours' as a deadline", async () => {
    const r = await parse("call bank in 2 hours");
    expect(r.estimateMinutes).toBeNull();
    expect(r.deadline?.getHours()).toBe(12);
    expect(r.title).toBe("Call bank");
  });

  it("reads explicit priority markers and strips them", async () => {
    expect(await parse("pay the credit card p1")).toMatchObject({
      title: "Pay the credit card",
      priority: 1,
    });
    expect(await parse("!! renew passport")).toMatchObject({
      title: "Renew passport",
      priority: 2,
    });
    expect(await parse("Call mum!")).toMatchObject({
      title: "Call mum!",
      priority: null,
    });
  });

  it("ignores month and weekday names used as ordinary words", async () => {
    for (const text of [
      "Send the March report",
      "watch may december",
      "buy a sunday paper",
      "Read the Monday report",
    ]) {
      const r = await parse(text);
      expect(r.deadline, text).toBeNull();
      expect(r.title, text).toBe(text.charAt(0).toUpperCase() + text.slice(1));
    }
  });

  it("keeps 'in March' as a date", async () => {
    const r = await parse("book holiday in March");
    expect(r.deadline?.getMonth()).toBe(2);
    expect(r.title).toBe("Book holiday");
  });

  it("keeps a possessive day in the title but still dates it", async () => {
    const r = await parse("prep slides for thursday's presentation");
    expect(r.title).toBe("Prep slides for thursday's presentation");
    expect(r.deadline?.getDay()).toBe(4);
  });

  it("reads 'the 1st' / 'by the 31st' as the next such day of the month", async () => {
    const a = await parse("pay rent on the 1st");
    expect(a.title).toBe("Pay rent");
    expect([a.deadline?.getMonth(), a.deadline?.getDate()]).toEqual([9, 1]);
    const b = await parse("submit tax return by the 31st");
    expect(b.title).toBe("Submit tax return");
    // September has no 31st, so the next one is in October.
    expect([b.deadline?.getMonth(), b.deadline?.getDate()]).toEqual([9, 31]);
  });

  it("reads end of day as 5pm today", async () => {
    for (const text of [
      "finish report by eod",
      "email boss end of day",
      "send invoice cob",
    ]) {
      const r = await parse(text);
      expect(r.deadline?.getDate(), text).toBe(23);
      expect(r.deadline?.getHours(), text).toBe(17);
      expect(r.title, text).not.toMatch(/eod|end of day|cob/i);
    }
  });

  it("gives date-only deadlines the end of the day, like the Today button", async () => {
    const r = await parse("call grandma on sunday");
    expect(r.deadline?.getDate()).toBe(27);
    expect([r.deadline?.getHours(), r.deadline?.getMinutes()]).toEqual([
      23, 59,
    ]);
  });

  it("uses the same part-of-day hours as repeats", async () => {
    const hour = async (t: string) => (await parse(t)).deadline?.getHours();
    expect(await hour("tomorrow morning go for a walk")).toBe(9);
    expect(await hour("fix bike this afternoon")).toBe(14);
    expect(await hour("buy milk this evening")).toBe(18);
    expect(await hour("take out the bins tonight")).toBe(21);
  });

  it("reads 'next week' as next Monday", async () => {
    const r = await parse("book flights next week");
    expect(r.deadline?.getDay()).toBe(1);
    expect(r.deadline?.getDate()).toBe(28);
  });

  it("reads tmr as tomorrow", async () => {
    const r = await parse("gym tmr 7am");
    expect(r.title).toBe("Gym");
    expect(r.deadline?.getDate()).toBe(24);
    expect(r.deadline?.getHours()).toBe(7);
  });

  it("reads slashed dates day-first or month-first", async () => {
    const dmy = await parseTaskText("doctor on 12/10", {
      now,
      dateOrder: "DMY",
    });
    expect([dmy.deadline?.getMonth(), dmy.deadline?.getDate()]).toEqual([
      9, 12,
    ]);
    const mdy = await parseTaskText("doctor on 12/10", {
      now,
      dateOrder: "MDY",
    });
    expect([mdy.deadline?.getMonth(), mdy.deadline?.getDate()]).toEqual([
      11, 10,
    ]);
  });

  it("does not mangle repeats it cannot store", async () => {
    const r = await parse("take meds every 8 hours");
    expect(r).toMatchObject({
      title: "Take meds every 8 hours",
      deadline: null,
      recurrence: null,
    });
  });

  it("cleans a leading label and lead-in phrases", async () => {
    expect((await parse("tonight: read")).title).toBe("Read");
    expect((await parse("don't forget to water plants")).title).toBe(
      "Water plants",
    );
    expect((await parse("I need to renew my passport")).title).toBe(
      "Renew my passport",
    );
  });

  it("drops the repeat's words when a weekday repeat starts the text", async () => {
    const r = await parse("every other tuesday piano");
    expect(r).toMatchObject({
      title: "Piano",
      recurrence: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
    });
    expect(r.deadline?.getDay()).toBe(2);
  });

  it("uses the repeat's part of day", async () => {
    const r = await parse("bin day every thursday night");
    expect(r.title).toBe("Bin day");
    expect(r.deadline?.getDate()).toBe(24);
    expect(r.deadline?.getHours()).toBe(21);
  });
});

describe("parseTaskText: #category tags", () => {
  const now = new Date(2026, 8, 23, 10, 0);
  const categories = ["work", "health", "side project"];
  const parse = (text: string) =>
    parseTaskText(text, { now, dateOrder: "DMY", categories });

  it("sets one of the user's categories and strips the tag", async () => {
    expect(await parse("buy plasters #health")).toMatchObject({
      title: "Buy plasters",
      category: "health",
    });
    expect(await parse("#Work email Sarah tomorrow")).toMatchObject({
      title: "Email Sarah",
      category: "work",
    });
  });

  it("matches multi-word categories written as one tag", async () => {
    expect((await parse("ship landing page #sideproject")).category).toBe(
      "side project",
    );
    expect((await parse("ship landing page #side-project")).category).toBe(
      "side project",
    );
  });

  it("leaves tags that aren't categories in the title", async () => {
    expect(await parse("rank the #1 priority list #health")).toMatchObject({
      title: "Rank the #1 priority list",
      category: "health",
    });
    expect(await parse("post about #buildinpublic")).toMatchObject({
      title: "Post about #buildinpublic",
      category: null,
    });
  });

  it("ignores a # inside a word", async () => {
    expect((await parse("learn C#work")).category).toBeNull();
  });

  it("reads no category without a list", async () => {
    const r = await parseTaskText("buy plasters #health", { now });
    expect(r).toMatchObject({ title: "Buy plasters #health", category: null });
  });
});

// Holes found by an adversarial review; each row once parsed wrongly.
describe("parseTaskText: regressions from the adversarial review", () => {
  // Wednesday 23 Sep 2026, 10:00 local.
  const now = new Date(2026, 8, 23, 10, 0);
  const parse = (text: string) =>
    parseTaskText(text, { now, dateOrder: "DMY" });
  const at = (d: Date | null) =>
    d &&
    `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

  it.each([
    // words that only look like dates
    ["buy sun cream", "Buy sun cream"],
    ["fix the sat nav", "Fix the sat nav"],
    ["add 1/2 cup flour", "Add 1/2 cup flour"],
    ["meet on the 2nd floor", "Meet on the 2nd floor"],
    ["write the 1st draft", "Write the 1st draft"],
    ["twice a week swim", "Twice a week swim"],
    ["3 times a day meds", "3 times a day meds"],
    ["for 3 weeks antibiotics", "For 3 weeks antibiotics"],
    ["buy 2m of fabric", "Buy 2m of fabric"],
    ["update to iOS 17.2", "Update to iOS 17.2"],
  ])("finds no date in %s", async (text, title) => {
    expect(await parse(text)).toMatchObject({
      title,
      deadline: null,
      recurrence: null,
    });
  });

  it.each([
    ["read the Daily Mail", "Read the Daily Mail"],
    ["the weekly shop", "The weekly shop"],
    ["mondays are hard", "Mondays are hard"],
    ["every 2nd tuesday book club", "Every 2nd tuesday book club"],
    ["every 1st and 15th pay", "Every 1st and 15th pay"],
  ])("finds no repeat in %s", async (text, title) => {
    expect(await parse(text)).toMatchObject({ title, recurrence: null });
  });

  it.each([
    ["every morning at 7", "9/24 7:00"],
    ["every evening at 8", "9/23 20:00"],
    ["tomorrow morning at 7", "9/24 7:00"],
    ["tomorrow evening at 6", "9/24 18:00"],
    ["tonight at 11 read", "9/23 23:00"],
    ["dinner tomorrow at 7", "9/24 19:00"],
    ["pick up at half 3", "9/23 15:30"],
    ["half 5 pick up kids", "9/23 17:30"],
    ["quarter to 9 train", "9/24 8:45"],
    ["quarter past 3 call", "9/23 15:15"],
    ["friday end of day", "9/25 17:00"],
    ["pay rent on the 1st at 9am", "10/1 9:00"],
    ["this sun bbq", "9/27 23:59"],
    ["call bob on sat", "9/26 23:59"],
    ["for tomorrow buy present", "9/24 23:59"],
  ])("%s → %s", async (text, when) => {
    expect(at((await parse(text)).deadline)).toBe(when);
  });

  it.each([
    ["every day except sunday walk", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA"],
    ["every day except sat and sun read", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"],
    ["every jan 1 renew", "FREQ=YEARLY"],
    ["gym mondays", "FREQ=WEEKLY;BYDAY=MO"],
    ["mondays at 6 gym", "FREQ=WEEKLY;BYDAY=MO"],
  ])("%s → %s", async (text, rrule) => {
    expect((await parse(text)).recurrence).toBe(rrule);
  });

  it("dates a yearly repeat on its day", async () => {
    const r = await parse("every jan 1 renew");
    expect(r.title).toBe("Renew");
    expect(at(r.deadline)).toBe("1/1 23:59");
  });

  it.each([
    ["run for an hour", "Run", 60],
    ["read for half an hour", "Read", 30],
    ["meet 2-3pm", "Meet", 60],
    ["2 hour drive to Leeds on friday", "Drive to Leeds", 120],
  ])("reads the length of %s", async (text, title, minutes) => {
    expect(await parse(text)).toMatchObject({
      title,
      estimateMinutes: minutes,
    });
  });

  it.each([
    // only words next to a cut phrase dangle
    ["turn the heating on", "Turn the heating on"],
    ["sign up for", "Sign up for"],
    ["log in", "Log in"],
    ["check in with Sam friday", "Check in with Sam"],
    ["before friday submit", "Submit"],
    ["the dentist is at 3pm tomorrow", "The dentist"],
    ["Is the shop open on sunday?", "Is the shop open?"],
    // brand casing survives
    ["iPhone case", "iPhone case"],
    ["eBay listing tomorrow", "eBay listing"],
    // lead-ins
    ["I also need to call the bank", "Call the bank"],
    ["Also call mom", "Call mom"],
  ])("titles %s as %s", async (text, title) => {
    expect((await parse(text)).title).toBe(title);
  });
});
