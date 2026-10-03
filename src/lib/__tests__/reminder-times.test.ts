import { describe, expect, it } from "vitest";
import {
  formatReminderTime,
  reminderPresets,
  upcomingReminder,
} from "@/lib/reminder-times";

const at = (h: number, m = 0, dayOffset = 0) => {
  const d = new Date(2026, 9, 5, h, m, 0, 0); // Mon 5 Oct 2026, local time
  d.setDate(d.getDate() + dayOffset);
  return d;
};

describe("reminderPresets", () => {
  it("offers an hour, this evening and tomorrow morning during the day", () => {
    const p = reminderPresets(at(14, 2), {
      shutdown_time: "18:30:00",
      nudge_time: "09:15:00",
    });
    expect(p.map((x) => x.id)).toEqual(["hour", "evening", "morning"]);
    // Rounded up to a clean five minutes.
    expect(p[0].at).toEqual(at(15, 5));
    expect(p[1].at).toEqual(at(18, 30));
    expect(p[2].at).toEqual(at(9, 15, 1));
  });

  it("drops 'this evening' once the evening is close or past", () => {
    expect(
      reminderPresets(at(17, 0), { shutdown_time: "18:00" }).map((x) => x.id),
    ).toEqual(["hour", "morning"]);
    expect(
      reminderPresets(at(21, 0), { shutdown_time: "18:00" }).map((x) => x.id),
    ).toEqual(["hour", "morning"]);
  });

  it("falls back to 18:00 and 10:00 for missing or odd settings", () => {
    const p = reminderPresets(at(9, 0), {
      shutdown_time: null,
      nudge_time: "nonsense",
    });
    expect(p.find((x) => x.id === "evening")?.at).toEqual(at(18, 0));
    expect(p.find((x) => x.id === "morning")?.at).toEqual(at(10, 0, 1));
  });
});

describe("formatReminderTime", () => {
  it("says just the time today, and Tomorrow for tomorrow", () => {
    const now = at(9, 0);
    expect(formatReminderTime(at(15, 0), now)).not.toMatch(/Tomorrow|,/);
    expect(formatReminderTime(at(10, 0, 1), now)).toMatch(/^Tomorrow /);
    expect(formatReminderTime(at(10, 0, 3), now)).toMatch(/, /);
  });
});

describe("upcomingReminder", () => {
  const now = at(12, 0).getTime();
  it("shows a future, unsent reminder", () => {
    expect(
      upcomingReminder(
        { remind_at: at(13, 0).toISOString(), reminder_sent_at: null },
        now,
      ),
    ).toEqual(at(13, 0));
  });
  it("hides sent, past or missing reminders", () => {
    const later = at(13, 0).toISOString();
    expect(
      upcomingReminder({ remind_at: later, reminder_sent_at: later }, now),
    ).toBeNull();
    expect(
      upcomingReminder(
        { remind_at: at(11, 0).toISOString(), reminder_sent_at: null },
        now,
      ),
    ).toBeNull();
    expect(
      upcomingReminder({ remind_at: null, reminder_sent_at: null }, now),
    ).toBeNull();
  });
});
