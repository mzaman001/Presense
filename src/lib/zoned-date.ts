/**
 * Dates as they read in a given timezone, the same on the server and in the
 * browser. The Do list renders on the server in the user's saved timezone,
 * so its date logic can't lean on the machine's local clock (Date's
 * toDateString/getDate) or the browser's locale: both differ between the
 * two and would break hydration. Locale is fixed to en-US, as the task
 * cards already used for dates.
 *
 * `timeZone` undefined means the device's own zone.
 */

// Creating an Intl.DateTimeFormat is slow (locale data); keep one per use
// and zone.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(
  kind: string,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${kind}|${timeZone ?? ""}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(kind === "key" ? "en-CA" : "en-US", {
      ...options,
      timeZone,
    });
    formatters.set(key, f);
  }
  return f;
}

/** The device's IANA timezone, e.g. "Asia/Kolkata". */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** "YYYY-MM-DD": the calendar date of `date` in `timeZone`. */
export function dateKeyIn(date: Date, timeZone?: string): string {
  // en-CA formats as YYYY-MM-DD.
  return formatter("key", timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Moves a "YYYY-MM-DD" key by whole calendar days. */
export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** "Oct 7" */
export function formatShortDate(date: Date, timeZone?: string): string {
  return formatter("short", timeZone, {
    month: "short",
    day: "numeric",
  }).format(date);
}

/** "3:05 PM" */
export function formatClockTime(date: Date, timeZone?: string): string {
  return formatter("time", timeZone, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "Mon, Oct 12" */
export function formatWeekdayDate(date: Date, timeZone?: string): string {
  return formatter("weekday", timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}
