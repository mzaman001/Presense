/**
 * When a completed recurring task comes back. Pure, with no Deno or npm
 * imports, so the cron function and the app's unit tests share it.
 *
 * The rules, for the shapes the task parser writes
 * (src/lib/nlp/parse-task-text.ts):
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, optional INTERVAL=n,
 *   WEEKLY;BYDAY=MO,TH and MONTHLY;BYMONTHDAY=n.
 *
 * - Days are the user's calendar days, in their timezone.
 * - The next date is after both the day it was completed and the day it was
 *   due, so finishing Monday's task on Saturday doesn't bring back that
 *   same Monday.
 * - Intervals count from the previous due date (or the completion day when
 *   there was none), so "every other Tuesday" keeps its weeks even when a
 *   task is done late.
 * - "Every week/month/year" without a day repeats on the previous due date's
 *   weekday / day of month / date.
 * - Months and years without the day are skipped (a 31st, 29 February),
 *   the same as firstOccurrence in the parser.
 * - The time of day is the previous due date's, else the fallback (the
 *   user's nudge time).
 */

export interface NextOccurrenceInput {
  rrule: string;
  completedAt: Date;
  /** The completed task's due date, if it had one. */
  previousDeadline: Date | null;
  /** IANA zone, e.g. "Europe/London". Invalid or empty means UTC. */
  timeZone: string | null | undefined;
  /** Time of day to use when there was no previous due date. */
  fallbackTime: { hour: number; minute: number };
}

type Day = { y: number; m: number; d: number }; // m is 0-based

const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MS_PER_DAY = 86_400_000;

function validZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** The wall-clock date and time of `instant` in `timeZone`. */
function wallClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    day: { y: get("year"), m: get("month") - 1, d: get("day") },
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/** The instant a wall-clock time in `timeZone` happens (DST-safe). */
function atWallClock(
  day: Day,
  time: { hour: number; minute: number },
  timeZone: string,
): Date {
  const wanted = Date.UTC(day.y, day.m, day.d, time.hour, time.minute);
  const offsetAt = (instant: number) => {
    const w = wallClock(new Date(instant), timeZone);
    return (
      Date.UTC(w.day.y, w.day.m, w.day.d, w.hour, w.minute) -
      Math.floor(instant / 60_000) * 60_000
    );
  };
  let instant = wanted - offsetAt(wanted);
  // Near a DST change the offset at the guess can differ; one more pass
  // settles it. A time that doesn't exist (the skipped hour) lands just after.
  instant = wanted - offsetAt(instant);
  return new Date(instant);
}

const dayNumber = (day: Day) => Date.UTC(day.y, day.m, day.d) / MS_PER_DAY;
const fromDayNumber = (n: number): Day => {
  const date = new Date(n * MS_PER_DAY);
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth(),
    d: date.getUTCDate(),
  };
};
const weekday = (n: number) => new Date(n * MS_PER_DAY).getUTCDay();
// Monday-start week index (day 0, 1 Jan 1970, was a Thursday).
const weekIndex = (n: number) => Math.floor((n + 3) / 7);

/** Day number of y-m-d, or null when that month has no such day. */
function realDay(y: number, m: number, d: number): number | null {
  const date = new Date(Date.UTC(y, m, d));
  return date.getUTCDate() === d ? date.getTime() / MS_PER_DAY : null;
}

function nextDay(
  rrule: string,
  reference: number,
  after: number,
): number | null {
  const freq = rrule.match(/FREQ=([A-Z]+)/)?.[1];
  const interval = Math.max(1, Number(rrule.match(/INTERVAL=(\d+)/)?.[1] ?? 1));
  const ref = fromDayNumber(reference);
  const last = fromDayNumber(after);
  // Start the month/year search near `after`, on the interval's beat.
  const onBeat = (gap: number) =>
    Math.max(0, Math.floor(gap / interval) * interval);

  if (freq === "DAILY") {
    const steps = Math.floor((after - reference) / interval) + 1;
    return reference + Math.max(1, steps) * interval;
  }

  if (freq === "WEEKLY") {
    const byDay = rrule.match(/BYDAY=([A-Z,]+)/)?.[1].split(",");
    const days = byDay?.length ? byDay : [WEEKDAY_CODES[weekday(reference)]];
    const refWeek = weekIndex(reference);
    // Up to `interval` weeks past the next active week, plus a week.
    for (let n = after + 1; n <= after + 7 * (interval + 1); n++) {
      const inActiveWeek = (weekIndex(n) - refWeek) % interval === 0;
      if (inActiveWeek && days.includes(WEEKDAY_CODES[weekday(n)])) return n;
    }
    return null;
  }

  if (freq === "MONTHLY") {
    const byMonthDay = rrule.match(/BYMONTHDAY=(\d+)/)?.[1];
    const dom = byMonthDay ? Number(byMonthDay) : ref.d;
    // Enough months to get over any run of months without the day.
    const start = onBeat((last.y - ref.y) * 12 + (last.m - ref.m));
    for (let k = start; k <= start + 48; k += interval) {
      const n = realDay(ref.y, ref.m + k, dom);
      if (n !== null && n > after) return n;
    }
    return null;
  }

  if (freq === "YEARLY") {
    // 29 February needs up to eight years to come round.
    const start = onBeat(last.y - ref.y);
    for (let k = start; k <= start + 8 * interval; k += interval) {
      const n = realDay(ref.y + k, ref.m, ref.d);
      if (n !== null && n > after) return n;
    }
    return null;
  }

  return null;
}

export function nextOccurrence({
  rrule,
  completedAt,
  previousDeadline,
  timeZone,
  fallbackTime,
}: NextOccurrenceInput): Date | null {
  const zone = validZone(timeZone);
  const completed = dayNumber(wallClock(completedAt, zone).day);
  const due = previousDeadline ? wallClock(previousDeadline, zone) : null;
  const dueDay = due ? dayNumber(due.day) : null;

  const reference = dueDay ?? completed;
  const after = Math.max(completed, dueDay ?? completed);
  const day = nextDay(rrule, reference, after);
  if (day === null) return null;

  const time = due ? { hour: due.hour, minute: due.minute } : fallbackTime;
  return atWallClock(fromDayNumber(day), time, zone);
}
