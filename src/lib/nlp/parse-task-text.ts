/**
 * Natural-language task parsing shared by the task panel and Quick Capture:
 * repeats ("everyday", "every mon & thu", "every month on the 1st"),
 * dates and times (chrono-node plus our custom phrases), explicit priority
 * markers ("p1", "!!"), durations as estimates ("30 min"), #category
 * tags from the user's own categories, and a cleaned
 * title with the parsed words removed.
 */

/** Day-first ("12/10" = 12 Oct) or month-first ("12/10" = 10 Dec). */
export type DateOrder = "DMY" | "MDY";

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
  /** 1 = urgent … 4 = low, only from an explicit marker. */
  priority: 1 | 2 | 3 | 4 | null;
  /** From a duration like "30 min" or "1h30m". */
  estimateMinutes: number | null;
  /** One of the given categories, only from a "#tag". */
  category: string | null;
}

/** Hours for parts of the day, shared by repeats and one-off dates. */
const PART_OF_DAY: Record<string, number> = {
  morning: 9,
  afternoon: 14,
  evening: 18,
  night: 21,
  tonight: 21,
};

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
const DAY_LIST = `(${DAY}(?:${LIST_SEP}${DAY})*)`;
const MONTH = `(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

const RULES: Rule[] = [
  {
    // Todoist has no "except"; we store it as the days that remain.
    re: new RegExp(
      `\\bevery\\s*day\\s+(?:except|but(?:\\s+not)?)\\s+(?:on\\s+)?${DAY_LIST}`,
      "i",
    ),
    build: (m) => {
      const skip = byDay(m[1]).split(",");
      const days = WEEKDAY_CODES.filter((c) => !skip.includes(c));
      return { rrule: `FREQ=WEEKLY;BYDAY=${days.join(",")}` };
    },
  },
  {
    // "every jan 1" / "every 1st march": the date itself is left for chrono.
    re: new RegExp(
      `\\b(?:every|each)\\s+(?=${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b)`,
      "i",
    ),
    build: () => ({ rrule: "FREQ=YEARLY" }),
  },
  {
    re: new RegExp(`\\bevery\\s+other\\s+(?:week\\s+on\\s+)?${DAY_LIST}`, "i"),
    build: (m) => ({ rrule: `FREQ=WEEKLY;INTERVAL=2;BYDAY=${byDay(m[1])}` }),
  },
  {
    re: new RegExp(`\\bevery\\s+(\\d+)\\s+weeks?\\s+on\\s+${DAY_LIST}`, "i"),
    build: (m) => {
      const n = Number(m[1]);
      const interval = n > 1 ? `;INTERVAL=${n}` : "";
      return { rrule: `FREQ=WEEKLY${interval};BYDAY=${byDay(m[2])}` };
    },
  },
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
    // Not "every 2nd tuesday" or "every 1st and 15th": we can't store those,
    // so they stay as words rather than becoming a wrong repeat.
    re: new RegExp(
      `\\b(?:every|each)\\s+${ordinal}\\b(?!\\s+${DAY}|\\s*(?:,|&|\\band\\b)\\s*\\d)`,
      "i",
    ),
    build: (m) => ({ rrule: `FREQ=MONTHLY;BYMONTHDAY=${Number(m[1])}` }),
  },
  {
    re: new RegExp(`\\b(?:every|each)\\s+(${DAY}(?:${LIST_SEP}${DAY})*)`, "i"),
    build: (m) => ({ rrule: `FREQ=WEEKLY;BYDAY=${byDay(m[1])}` }),
  },
  {
    re: new RegExp(
      `\\bon\\s+(${PLURAL_DAY}(?:${LIST_SEP}${PLURAL_DAY})*)`,
      "i",
    ),
    build: (m) => ({ rrule: `FREQ=WEEKLY;BYDAY=${byDay(m[1])}` }),
  },
  {
    // Bare "mondays" only where it reads as a schedule ("gym mondays",
    // "mondays at 6"), not as a subject ("mondays are hard").
    re: new RegExp(
      `\\b(${PLURAL_DAY}(?:${LIST_SEP}${PLURAL_DAY})*)(?=\\s*$|\\s*[,.;:!?]|\\s+(?:at|from|and|morning|afternoon|evening|night)\\b|\\s+\\d)`,
      "i",
    ),
    build: (m) => ({ rrule: `FREQ=WEEKLY;BYDAY=${byDay(m[1])}` }),
  },
  {
    re: /\b(?:(?:every|each)\s+(morning|afternoon|evening|night)|(nightly))\b/i,
    build: (m) => {
      const hour = PART_OF_DAY[(m[1] ?? "night").toLowerCase()];
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

// "read the Daily Mail", "the weekly report": a name or a thing, not a repeat.
const REPEAT_ADVERB =
  /^(?:daily|weekly|monthly|yearly|annually|nightly|fortnightly|bi-?weekly)$/i;
const DETERMINER =
  /\b(?:the|a|an|my|our|your|his|her|their|this|that|these|those)\s+$/i;

export function detectRecurrence(text: string): Recurrence | null {
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    if (
      REPEAT_ADVERB.test(m[0].trim()) &&
      DETERMINER.test(text.slice(0, m.index))
    )
      continue;
    const built = rule.build(m);
    if (!built) continue;
    let match = m[0];
    // "every thursday night": the part of day right after sets the time.
    if (!built.time) {
      const after = text.slice((m.index ?? 0) + match.length);
      const part = after.match(/^\s+(morning|afternoon|evening|night)\b/i);
      if (part) {
        match += part[0];
        built.time = { hour: PART_OF_DAY[part[1].toLowerCase()], minute: 0 };
      }
    }
    return { ...built, match };
  }
  return null;
}

// ─── Priority and estimate ──────────────────────────────────────────────────

const PRIORITY = /(^|\s)(?:p([1-4])|(!{1,3}))(?=\s|$)/i;

function takePriority(text: string) {
  const m = text.match(PRIORITY);
  if (!m) return { text, priority: null };
  const priority = (m[2] ? Number(m[2]) : 4 - m[3].length) as 1 | 2 | 3 | 4;
  return { text: text.replace(m[0], m[1] + " "), priority };
}

// "#health", "#side-project". Not "C#work": the # has to start a word.
const TAG = /(^|\s)#([\p{L}\p{N}_-]+)(?=[\s,.;!?]|$)/gu;
const tagKey = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** The first #tag naming one of `categories`; other tags stay as text. */
function takeCategory(text: string, categories: string[]) {
  const byKey = new Map(categories.map((c) => [tagKey(c), c]));
  for (const m of text.matchAll(TAG)) {
    const category = byKey.get(tagKey(m[2]));
    if (category) return { text: text.replace(m[0], m[1] + " "), category };
  }
  return { text, category: null };
}

const ESTIMATE =
  /(^|\s)(?:for\s+)?(?:(\d+(?:\.\d+)?)\s*-?\s*(?:h|hrs?|hours?)(?:\s*(\d+)\s*-?\s*(?:m|mins?|minutes?))?|(\d+)\s*-?\s*(?:m|mins?|minutes?))(?=[\s,.;!?]|$)/gi;
// "in 30 min" is a deadline and "every 8 hours" a repeat, not an estimate.
const NOT_ESTIMATE_BEFORE =
  /\b(?:in|within|every|each|after|before|than|next|last)\s*$/i;

const WORD_ESTIMATES: [RegExp, number][] = [
  [/\bfor\s+(?:an|one)\s+hour\s+and\s+a\s+half\b/i, 90],
  [/\bfor\s+(?:half\s+an|a\s+half)\s+hour\b/i, 30],
  [/\bfor\s+(?:an|one)\s+hour\b/i, 60],
];

function takeEstimate(text: string) {
  for (const [re, minutes] of WORD_ESTIMATES) {
    const m = text.match(re);
    if (m) return { text: cut(text, m[0]), estimateMinutes: minutes };
  }
  for (const m of text.matchAll(ESTIMATE)) {
    const before = text.slice(0, (m.index ?? 0) + m[1].length);
    if (NOT_ESTIMATE_BEFORE.test(before)) continue;
    // "2m of fabric" is a length.
    if (/^\s+of\b/i.test(text.slice((m.index ?? 0) + m[0].length))) continue;
    const minutes = m[4]
      ? Number(m[4])
      : Math.round(Number(m[2]) * 60 + Number(m[3] ?? 0));
    if (minutes < 1 || minutes > 24 * 60) continue;
    return { text: cut(text, m[0]), estimateMinutes: minutes };
  }
  return { text, estimateMinutes: null };
}

/**
 * Removed date, repeat and duration words leave this mark, so the title
 * clean-up only drops a dangling "at" or "by" where one was actually cut
 * ("turn the heating on" keeps its "on").
 */
const MARK = "\u0000";
function cut(text: string, fragment: string) {
  return text.replace(fragment, ` ${MARK} `);
}

/** UK/spoken times chrono doesn't read: "half 5", "quarter past 3". */
function normaliseSpokenTimes(text: string) {
  const at = (h: string, m: number) => {
    const hour = Number(h);
    if (m < 0) return `${hour === 1 ? 12 : hour - 1}:${60 + m}`;
    return `${hour}:${String(m).padStart(2, "0")}`;
  };
  return text
    .replace(/\bhalf\s+past\s+(\d{1,2})\b/gi, (_, h) => at(h, 30))
    .replace(/\bquarter\s+past\s+(\d{1,2})\b/gi, (_, h) => at(h, 15))
    .replace(/\bquarter\s+to\s+(\d{1,2})\b/gi, (_, h) => at(h, -15))
    .replace(
      /(^|\b(?:at|by|from|until|till)\s+)half\s+(\d{1,2})\b(?!\s*(?:[:.]\d|%|x\b|times\b|of\b))/gi,
      (_, pre, h) => pre + at(h, 30),
    );
}

// ─── Dates ──────────────────────────────────────────────────────────────────

type ChronoParser = (typeof import("chrono-node"))["casual"];

let chronoPromise: Promise<Record<DateOrder, ChronoParser>> | null = null;
function loadChrono() {
  chronoPromise ??= (async () => {
    const chrono = await import("chrono-node");
    const { registerCustomParsers } = await import("@/lib/chrono-custom");
    const parsers = {
      MDY: chrono.casual.clone(),
      DMY: chrono.en.GB.clone(),
    };
    registerCustomParsers(parsers.MDY);
    registerCustomParsers(parsers.DMY);
    return parsers;
  })();
  return chronoPromise;
}

/** The viewer's date order, from how their locale writes 31 December. */
function localeDateOrder(): DateOrder {
  try {
    const parts = new Intl.DateTimeFormat().formatToParts(
      new Date(2000, 11, 31),
    );
    const month = parts.findIndex((p) => p.type === "month");
    const day = parts.findIndex((p) => p.type === "day");
    return month < day ? "MDY" : "DMY";
  } catch {
    return "MDY";
  }
}

const MONTH_WORD =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;
const WEEKDAY_ONLY = new RegExp(`^${DAY}$`, "i");

type ChronoResult = ReturnType<ChronoParser["parse"]>[number];

/**
 * Chrono reads any month or weekday name as a date. Drop the ones used as
 * ordinary words: "the March report", "watch may december", "a sunday
 * paper", and the "8 hours" of "every 8 hours" (a repeat we can't store).
 */
function isRealDate(text: string, r: ChronoResult): boolean {
  const before = text.slice(0, r.index);
  const after = text.slice(r.index + r.text.length);
  const said = r.text.trim();
  const words = said.split(/\s+/);
  // Part of a repeat we couldn't read: "every 8 hours", "every 2nd tuesday".
  if (/\bevery\s+(?:\S+\s+){0,2}$/i.test(before)) return false;
  // How often, not when: "twice a week", "3 times a day".
  if (/\b(?:once|twice|thrice|\d+\s*(?:x|times))\s*$/i.test(before))
    return false;
  // How long, not when: "for 3 weeks", a bare "2m". Only "in 3 weeks" /
  // "within an hour" / "after 2 days" put a length on the calendar.
  if (
    /^(?:for\s+)?(?:\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|a few|a couple of|several)\s*(?:m|mins?|minutes?|h|hrs?|hours?|days?|weeks?|months?|years?)$/i.test(
      said,
    ) &&
    !/\b(?:in|within|after)\s*$/i.test(before)
  )
    return false;
  // A fraction: "1/2 cup", "3/4 of the report".
  if (
    /^\d{1,2}\/\d{1,2}$/.test(said) &&
    /^\s*(?:cups?|tsp|tbsp|teaspoons?|tablespoons?|lbs?|kg|g|oz|ml|l|litres?|liters?|pints?|inch(?:es)?|miles?|km|of|an?)\b/i.test(
      after,
    )
  )
    return false;
  // "sun cream", "sat nav", "get wed": only a date with a date word before.
  if (
    /^(?:sun|sat|wed)$/i.test(said) &&
    !/\b(?:on|by|until|till|this|next|due|before|from|every)\s*$/i.test(before)
  )
    return false;
  if (
    words.every((w) => MONTH_WORD.test(w)) &&
    !/\b(?:in|by|until|till|before|during|from|since|on)\s*$/i.test(before)
  )
    return false;
  if (
    WEEKDAY_ONLY.test(r.text.trim()) &&
    /\b(?:a|an|the|my|our|your|his|her|their)\s*$/i.test(before)
  )
    return false;
  return true;
}

/** "thursday's presentation": the date counts but the words stay. */
function isPossessive(text: string, r: ChronoResult): boolean {
  return /^['’]s\b/i.test(text.slice(r.index + r.text.length));
}

type Time = { hour: number; minute: number };

/**
 * The date and time a chrono result means, with our own time rules.
 * `partOfDay` is a "morning"/"evening" said anywhere in the text, which
 * settles am/pm for a bare hour ("every morning at 7").
 */
/**
 * A date nobody means: before today ("in -5 days") or more than ten years
 * out ("in 999999 weeks"). Read as plain words instead, so they stay in the
 * title rather than becoming a deadline.
 */
function isPlausible(date: Date, now: Date): boolean {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  return date >= startOfToday && date.getFullYear() <= now.getFullYear() + 10;
}

function readResult(r: ChronoResult, now: Date, partOfDay: string | null) {
  const date = r.start.date();
  const dayIsExplicit =
    r.start.isCertain("day") || r.start.isCertain("weekday");
  let time: Time | null = null;

  if (r.start.isCertain("hour")) {
    time = { hour: date.getHours(), minute: date.getMinutes() };
    const bare =
      !r.start.isCertain("meridiem") &&
      time.hour >= 1 &&
      time.hour <= 12 &&
      !/\b0\d:/.test(r.text);
    if (bare && partOfDay) {
      if (partOfDay !== "morning" && time.hour < 12) time.hour += 12;
    } else if (bare && time.hour <= 7) {
      // "call mom at 5" is 5pm, as in Todoist: nobody means 1–7am
      // without saying so.
      time.hour += 12;
    }
  } else {
    const part = r.text.match(/\b(morning|afternoon|evening|tonight|night)\b/i);
    if (part) {
      time = { hour: PART_OF_DAY[part[1].toLowerCase()], minute: 0 };
      // "tonight" said after 21:00 means later tonight, not earlier today.
      const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      const at = new Date(now);
      at.setHours(time.hour, time.minute, 0, 0);
      if (sameDay && at < now) time = { ...DATE_ONLY_TIME };
    }
  }

  const day = new Date(date);
  if (!dayIsExplicit && time) {
    // A time alone: today if it's still ahead, else tomorrow.
    day.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    day.setHours(time.hour, time.minute, 0, 0);
    if (day < now) day.setDate(day.getDate() + 1);
  }
  return { day, dayIsExplicit, time };
}

// Words that only belonged to a phrase we cut: "pay rent [on] the 1st",
// "[before] friday submit", "tonight[:] read".
const DANGLING_BEFORE_MARK = new RegExp(
  `(?:\\b(?:at|on|by|from|starting|due|before|until|till|for|around|is|are)\\s+|[,:\\-–]\\s*)${MARK}`,
  "gi",
);
const DANGLING_AFTER_MARK = new RegExp(`${MARK}\\s*[,:\\-–]`, "g");

/** Title tidy-up after removing parsed phrases: spacing and dangling words. */
function cleanTitle(text: string): string {
  let t = text;
  let prev;
  do {
    prev = t;
    t = t
      .replace(/\s+/g, " ")
      .replace(DANGLING_BEFORE_MARK, MARK)
      .replace(DANGLING_AFTER_MARK, MARK);
  } while (t !== prev);
  return t
    .replaceAll(MARK, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.,;])/g, "$1")
    .replace(/^[,:\-–]\s*|\s*[,:\-–]$/g, "")
    .trim();
}

/** Capitalise the first letter, unless the word has its own ("iPhone"). */
function capitalise(title: string) {
  const first = title.split(" ")[0];
  if (/[A-Z]/.test(first.slice(1))) return title;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/**
 * Words people put before the actual task: "remind me to", "don't forget
 * to", "I need to", "please", "todo:". Shared with the capture router.
 */
const LEAD_IN =
  /^(?:please\s+|also,?\s+|(?:remind\s+me|remember|(?:don['’]?t|do\s+not)\s+forget|(?:i\s+)?(?:(?:also|really|still|just)\s+)?(?:need|have|must|gotta|got)|i['’]?ve\s+(?:also\s+)?got)\s+to\s+|(?:i\s+)?(?:(?:also|really|still|just)\s+)?(?:must|gotta)\s+|(?:to-?do|task)\s*:\s*)/i;

export function stripLeadIn(text: string): string {
  let t = text.trim();
  let prev;
  do {
    prev = t;
    t = t.replace(LEAD_IN, "").trim();
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
    dateOrder = localeDateOrder(),
    categories = [],
  }: {
    now?: Date;
    parseDates?: boolean;
    dateOrder?: DateOrder;
    /** The user's categories; a "#tag" can only pick one of these. */
    categories?: string[];
  } = {},
): Promise<ParsedTaskText> {
  const withCategory = takeCategory(text, categories);
  const withPriority = takePriority(withCategory.text);
  const partOfDay =
    withPriority.text
      .match(/\b(morning|afternoon|evening|tonight|night)\b/i)?.[1]
      .toLowerCase() ?? null;
  const recurrence = detectRecurrence(withPriority.text);
  let rest = recurrence
    ? cut(withPriority.text, recurrence.match)
    : withPriority.text;
  const withEstimate = takeEstimate(rest);
  rest = normaliseSpokenTimes(withEstimate.text);
  let estimateMinutes = withEstimate.estimateMinutes;

  let parsed: ReturnType<typeof readResult> | null = null;

  if (parseDates) {
    const chrono = (await loadChrono())[dateOrder];
    // Chrono sees the marks as plain gaps, never as part of a date.
    const plain = rest.replaceAll(MARK, " ");
    const results = chrono
      .parse(plain, now, { forwardDate: true })
      .filter((r) => isRealDate(plain, r) && isPlausible(r.start.date(), now));
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
      parsed = readResult(best, now, partOfDay);
      // "meet 2-3pm": a time range also says how long it takes.
      if (
        estimateMinutes === null &&
        best.end?.isCertain("hour") &&
        best.start.isCertain("hour")
      ) {
        const span =
          (best.end.date().getTime() - best.start.date().getTime()) / 60000;
        if (span > 0 && span <= 24 * 60) estimateMinutes = Math.round(span);
      }
      // Same offsets in `rest` and `plain`: a mark is one character too.
      let removed = 0;
      for (const r of results) {
        if (isPossessive(plain, r)) continue;
        const at = r.index - removed;
        let head = rest.slice(0, at);
        // "in March": the "in" goes with a month name. (Not a general
        // dangling word: "check in" and "log in" end in it too.)
        if (MONTH_WORD.test(r.text.trim().split(/\s+/)[0]))
          head = head.replace(/\b(?:in|during)\s*$/i, "");
        const next = `${head} ${MARK} ${rest.slice(at + r.text.length)}`;
        removed += rest.length - next.length;
        rest = next;
      }
    }
  }

  let deadline: Date | null = null;
  if (recurrence && parseDates) {
    const time = parsed?.time ?? recurrence.time ?? DATE_ONLY_TIME;
    const from = parsed?.dayIsExplicit ? parsed.day : now;
    const fromDay = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate(),
    );
    deadline =
      parsed?.dayIsExplicit && parsed.time
        ? parsed.day
        : firstOccurrence(
            recurrence.rrule,
            fromDay,
            time,
            parsed?.dayIsExplicit ? fromDay : now,
          );
  } else if (parsed) {
    deadline = new Date(parsed.day);
    const time = parsed.time ?? DATE_ONLY_TIME;
    deadline.setHours(time.hour, time.minute, 0, 0);
  }

  const title = capitalise(stripLeadIn(cleanTitle(rest)));

  return {
    title: title || text.trim(),
    deadline,
    recurrence: recurrence?.rrule ?? null,
    priority: withPriority.priority,
    estimateMinutes,
    category: withCategory.category,
  };
}
