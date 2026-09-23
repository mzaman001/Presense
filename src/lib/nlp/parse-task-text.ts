/**
 * Natural-language task parsing shared by the task panel and Quick Capture:
 * repeats ("everyday", "every mon & thu", "every month on the 1st"),
 * dates and times (chrono-node plus our custom phrases), and a cleaned
 * title with the parsed words removed.
 */

export interface Recurrence {
  /** RRULE body, e.g. "FREQ=WEEKLY;BYDAY=MO,TH". */
  rrule: string;
  /** The exact text that expressed it, removed from the title. */
  match: string;
  /** A time implied by the phrase itself ("every morning"). */
  time?: { hour: number; minute: number };
}

export interface ParsedTaskText {
  title: string;
  deadline: Date | null;
  recurrence: string | null;
}

const UNIT: Record<string, string> = {
  day: "DAILY",
  week: "WEEKLY",
  month: "MONTHLY",
  year: "YEARLY",
};

// Longest first so "thursday" wins over "thu"; \b after each so "mon"
// never matches inside "month" or "monday" inside "mondays" half-way.
const DAY_WORDS = [
  "wednesdays",
  "wednesday",
  "thursdays",
  "thursday",
  "saturdays",
  "saturday",
  "tuesdays",
  "tuesday",
  "mondays",
  "monday",
  "fridays",
  "friday",
  "sundays",
  "sunday",
  "thurs",
  "tues",
  "weds",
  "thur",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];
const DAY = `(?:${DAY_WORDS.join("|")})\\b`;
const PLURAL_DAY = `(?:${DAY_WORDS.filter((d) => d.endsWith("days")).join("|")})\\b`;
const LIST_SEP = `\\s*(?:,|&|\\band\\b)\\s*`;

const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function dayCode(word: string): string {
  const w = word.toLowerCase();
  if (w.startsWith("tu")) return "TU";
  if (w.startsWith("th")) return "TH";
  return w.slice(0, 2).toUpperCase();
}

function byDay(listText: string): string {
  const found = listText.toLowerCase().match(new RegExp(DAY, "g")) ?? [];
  const codes = [...new Set(found.map(dayCode))];
  return WEEKDAY_CODES.filter((c) => codes.includes(c)).join(",");
}

const ordinal = `(\\d{1,2})(?:st|nd|rd|th)`;

type Rule = {
  re: RegExp;
  build: (m: RegExpMatchArray) => Omit<Recurrence, "match"> | null;
};

// Most specific first; the first rule that matches wins.
const RULES: Rule[] = [
  {
    re: /\bevery\s+other\s+(day|week|month|year)\b/i,
    build: (m) => ({ rrule: `FREQ=${UNIT[m[1].toLowerCase()]};INTERVAL=2` }),
  },
  {
    re: /\bevery\s+(\d+)\s+(day|week|month|year)s?\b/i,
    build: (m) => {
      const n = Number(m[1]);
      const freq = UNIT[m[2].toLowerCase()];
      return { rrule: n > 1 ? `FREQ=${freq};INTERVAL=${n}` : `FREQ=${freq}` };
    },
  },
  {
    re: /\b(?:fortnightly|bi-?weekly|every\s+fortnight)\b/i,
    build: () => ({ rrule: "FREQ=WEEKLY;INTERVAL=2" }),
  },
  {
    re: /\b(?:(?:every|each)\s+(?:week|work)\s*days?|(?:on\s+)?weekdays)\b/i,
    build: () => ({ rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" }),
  },
  {
    re: /\b(?:(?:every|each)\s+weekends?|(?:on\s+)?weekends)\b/i,
    build: () => ({ rrule: "FREQ=WEEKLY;BYDAY=SA,SU" }),
  },
  {
    re: new RegExp(
      `\\b(?:every|each)\\s*month\\s+on\\s+the\\s+${ordinal}\\b`,
      "i",
    ),
    build: (m) => ({ rrule: `FREQ=MONTHLY;BYMONTHDAY=${Number(m[1])}` }),
  },
  {
    re: new RegExp(`\\bmonthly\\s+on\\s+the\\s+${ordinal}\\b`, "i"),
    build: (m) => ({ rrule: `FREQ=MONTHLY;BYMONTHDAY=${Number(m[1])}` }),
  },
  {
    re: new RegExp(
      `\\bon\\s+the\\s+${ordinal}\\s+of\\s+(?:every|each)\\s+month\\b`,
      "i",
    ),
    build: (m) => ({ rrule: `FREQ=MONTHLY;BYMONTHDAY=${Number(m[1])}` }),
  },
  {
    re: new RegExp(`\\b(?:every|each)\\s+${ordinal}\\b`, "i"),
    build: (m) => ({ rrule: `FREQ=MONTHLY;BYMONTHDAY=${Number(m[1])}` }),
  },
  {
    re: new RegExp(`\\b(?:every|each)\\s+(${DAY}(?:${LIST_SEP}${DAY})*)`, "i"),
    build: (m) => ({ rrule: `FREQ=WEEKLY;BYDAY=${byDay(m[1])}` }),
  },
  {
    re: new RegExp(
      `\\b(?:on\\s+)?(${PLURAL_DAY}(?:${LIST_SEP}${PLURAL_DAY})*)`,
      "i",
    ),
    build: (m) => ({ rrule: `FREQ=WEEKLY;BYDAY=${byDay(m[1])}` }),
  },
  {
    re: /\b(?:(?:every|each)\s+(morning|afternoon|evening|night)|(nightly))\b/i,
    build: (m) => {
      const part = (m[1] ?? "night").toLowerCase();
      const hour = { morning: 9, afternoon: 14, evening: 18, night: 21 }[part]!;
      return { rrule: "FREQ=DAILY", time: { hour, minute: 0 } };
    },
  },
  {
    re: /\b(?:every\s*day|each\s+day|daily)\b/i,
    build: () => ({ rrule: "FREQ=DAILY" }),
  },
  {
    re: /\b(?:every\s*week|each\s+week|weekly)\b/i,
    build: () => ({ rrule: "FREQ=WEEKLY" }),
  },
  {
    re: /\b(?:every\s*month|each\s+month|monthly)\b/i,
    build: () => ({ rrule: "FREQ=MONTHLY" }),
  },
  {
    re: /\b(?:every\s*year|each\s+year|yearly|annually)\b/i,
    build: () => ({ rrule: "FREQ=YEARLY" }),
  },
];

export function detectRecurrence(text: string): Recurrence | null {
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    const built = rule.build(m);
    if (built) return { ...built, match: m[0] };
  }
  return null;
}

let chronoPromise: Promise<typeof import("chrono-node")> | null = null;
function loadChrono() {
  chronoPromise ??= (async () => {
    const chrono = await import("chrono-node");
    const { registerCustomParsers } = await import("@/lib/chrono-custom");
    registerCustomParsers(chrono);
    return chrono;
  })();
  return chronoPromise;
}

/** Title tidy-up after removing parsed phrases: spacing and dangling words. */
function cleanTitle(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  const edge =
    /^(?:at|on|by|from|starting|every|each|,|-|–)\s+|\s+(?:at|on|by|from|starting|,|-|–)$/i;
  let prev;
  do {
    prev = t;
    t = t
      .replace(edge, "")
      .replace(/^[,\-–]\s*|\s*[,\-–]$/g, "")
      .trim();
  } while (t !== prev);
  return t;
}

const DATE_ONLY_TIME = { hour: 23, minute: 59 };

/** First date on or after `from` (by day) that the repeat lands on. */
function firstOccurrence(
  rrule: string,
  from: Date,
  time: { hour: number; minute: number },
  now: Date,
): Date {
  const at = (d: Date) => {
    const x = new Date(d);
    x.setHours(time.hour, time.minute, 0, 0);
    return x;
  };
  const byDayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
  const byMonthDay = rrule.match(/BYMONTHDAY=(\d+)/);

  if (byDayMatch) {
    const days = byDayMatch[1].split(",");
    for (let i = 0; i < 8; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const code = WEEKDAY_CODES[(d.getDay() + 6) % 7];
      if (days.includes(code) && at(d) >= now) return at(d);
    }
  }
  if (byMonthDay) {
    const day = Number(byMonthDay[1]);
    for (let i = 0; i < 13; i++) {
      const d = new Date(from.getFullYear(), from.getMonth() + i, day);
      if (d.getDate() === day && at(d) >= now) return at(d);
    }
  }
  const first = at(from);
  if (first >= now) return first;
  const freq = rrule.match(/FREQ=([A-Z]+)/)?.[1];
  const next = new Date(first);
  if (freq === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (freq === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (freq === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  else next.setDate(next.getDate() + 1);
  return next;
}

export async function parseTaskText(
  text: string,
  {
    now = new Date(),
    parseDates = true,
  }: { now?: Date; parseDates?: boolean } = {},
): Promise<ParsedTaskText> {
  const recurrence = detectRecurrence(text);
  let rest = recurrence ? text.replace(recurrence.match, " ") : text;

  let parsedDate: Date | null = null;
  let dayIsExplicit = false;
  let parsedTime: { hour: number; minute: number } | null = null;

  if (parseDates) {
    const chrono = await loadChrono();
    const results = chrono.parse(rest, now, { forwardDate: true });
    if (results.length > 0) {
      // "tomorrow" + "at 9pm" can come back as two results; re-parse the
      // joined text so date and time merge into one.
      const merged =
        results.length > 1
          ? chrono.parse(results.map((r) => r.text).join(" "), now, {
              forwardDate: true,
            })[0]
          : results[0];
      const best = merged ?? results[0];
      parsedDate = best.start.date();
      dayIsExplicit =
        best.start.isCertain("day") || best.start.isCertain("weekday");
      if (best.start.isCertain("hour")) {
        parsedTime = {
          hour: parsedDate.getHours(),
          minute: parsedDate.getMinutes(),
        };
      }
      for (const r of results) rest = rest.replace(r.text, " ");
    }
  }

  let deadline: Date | null = parsedDate;
  if (recurrence && parseDates) {
    const time = parsedTime ?? recurrence.time ?? DATE_ONLY_TIME;
    const from = dayIsExplicit && parsedDate ? parsedDate : now;
    const fromDay = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate(),
    );
    deadline =
      dayIsExplicit && parsedDate && parsedTime
        ? parsedDate
        : firstOccurrence(
            recurrence.rrule,
            fromDay,
            time,
            dayIsExplicit ? fromDay : now,
          );
  }

  return {
    title: cleanTitle(rest) || text.trim(),
    deadline,
    recurrence: recurrence?.rrule ?? null,
  };
}
