import * as chrono from "chrono-node";

/**
 * Custom chrono parsers that fill gaps in chrono-node v2.9.1.
 * These are registered on chrono.casual.parsers at import time.
 */

function addParser(parser: { pattern: () => RegExp; extract: (context: never, match: never) => unknown }) {
  // Prepend so custom parsers run before built-in ones
  chrono.casual.parsers.unshift(parser as never);
}

// ── Multi-word relative phrases ──────────────────────────────────────────────

addParser({
  pattern: () => /day after tomorrow/i,
  extract(context: never, _match: never) {
    const ctx = context as { refDate: Date; createParsingComponents: () => { assign: (k: string, v: number) => void } };
    const component = ctx.createParsingComponents();
    const d = new Date(ctx.refDate);
    d.setDate(d.getDate() + 2);
    component.assign("day", d.getDate());
    component.assign("month", d.getMonth() + 1);
    component.assign("year", d.getFullYear());
    return component;
  },
});

addParser({
  pattern: () => /day before yesterday/i,
  extract(context: never, _match: never) {
    const ctx = context as { refDate: Date; createParsingComponents: () => { assign: (k: string, v: number) => void } };
    const component = ctx.createParsingComponents();
    const d = new Date(ctx.refDate);
    d.setDate(d.getDate() - 2);
    component.assign("day", d.getDate());
    component.assign("month", d.getMonth() + 1);
    component.assign("year", d.getFullYear());
    return component;
  },
});

// ── Named dates / holidays ───────────────────────────────────────────────────

const NAMED_DATES: Record<string, { month: number; day: number }> = {
  christmas: { month: 12, day: 25 },
  "christmas eve": { month: 12, day: 24 },
  "new years eve": { month: 12, day: 31 },
  "new year's eve": { month: 12, day: 31 },
  "new year": { month: 1, day: 1 },
  "new years": { month: 1, day: 1 },
  "new year's": { month: 1, day: 1 },
  "valentines day": { month: 2, day: 14 },
  "halloween": { month: 10, day: 31 },
  "independence day": { month: 7, day: 4 },
  "july 4th": { month: 7, day: 4 },
};

const namedDateRegex = new RegExp(
  Object.keys(NAMED_DATES)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "i"
);

addParser({
  pattern: () => namedDateRegex,
  extract(context: never, match: never) {
    const ctx = context as { refDate: Date; createParsingComponents: () => { assign: (k: string, v: number) => void } };
    const m = match as unknown as RegExpMatchArray;
    const key = m[0].toLowerCase();
    const { month, day } = NAMED_DATES[key];
    const year = ctx.refDate.getFullYear();
    const target = new Date(year, month - 1, day);
    // If the date already passed this year, use next year
    if (target < ctx.refDate) {
      target.setFullYear(year + 1);
    }
    const component = ctx.createParsingComponents();
    component.assign("day", target.getDate());
    component.assign("month", target.getMonth() + 1);
    component.assign("year", target.getFullYear());
    return component;
  },
});

// ── End-of-period phrases ────────────────────────────────────────────────────

addParser({
  pattern: () => /end of (?:the )?week/i,
  extract(context: never, _match: never) {
    const ctx = context as { refDate: Date; createParsingComponents: () => { assign: (k: string, v: number) => void } };
    const component = ctx.createParsingComponents();
    const d = new Date(ctx.refDate);
    const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSat);
    component.assign("day", d.getDate());
    component.assign("month", d.getMonth() + 1);
    component.assign("year", d.getFullYear());
    return component;
  },
});

addParser({
  pattern: () => /end of (?:the )?month/i,
  extract(context: never, _match: never) {
    const ctx = context as { refDate: Date; createParsingComponents: () => { assign: (k: string, v: number) => void } };
    const component = ctx.createParsingComponents();
    const d = new Date(ctx.refDate);
    d.setMonth(d.getMonth() + 1, 0); // last day of current month
    component.assign("day", d.getDate());
    component.assign("month", d.getMonth() + 1);
    component.assign("year", d.getFullYear());
    return component;
  },
});

addParser({
  pattern: () => /end of (?:the )?year/i,
  extract(context: never, _match: never) {
    const ctx = context as { refDate: Date; createParsingComponents: () => { assign: (k: string, v: number) => void } };
    const component = ctx.createParsingComponents();
    component.assign("day", 31);
    component.assign("month", 12);
    component.assign("year", ctx.refDate.getFullYear());
    return component;
  },
});
