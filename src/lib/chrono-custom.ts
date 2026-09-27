// Phrases chrono-node doesn't know. Registered once per parser instance
// (we keep a month-first and a day-first one).
const registered = new WeakSet<object>();

type Ctx = {
  refDate: Date;
  createParsingComponents: () => {
    assign: (k: string, v: number) => void;
    imply: (k: string, v: number) => void;
  };
};

/* @todo: Untyped usage justified per TOOL-01 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerCustomParsers(chrono: any) {
  if (registered.has(chrono)) return;
  registered.add(chrono);

  function addParser(
    pattern: RegExp,
    extract: (ctx: Ctx, match: RegExpMatchArray) => Date | null,
    { timeOnly = false }: { timeOnly?: boolean } = {},
  ) {
    // Prepend so custom parsers run before built-in ones
    chrono.parsers.unshift({
      pattern: () => pattern,
      extract(context: never, match: never) {
        const ctx = context as Ctx;
        const d = extract(ctx, match as unknown as RegExpMatchArray);
        if (!d) return null;
        const component = ctx.createParsingComponents();
        // A time-only phrase just implies its day, so chrono can merge it
        // with a day said next to it ("friday end of day").
        const setDay = timeOnly ? component.imply : component.assign;
        setDay.call(component, "day", d.getDate());
        setDay.call(component, "month", d.getMonth() + 1);
        setDay.call(component, "year", d.getFullYear());
        if (timeOnly) {
          component.assign("hour", d.getHours());
          component.assign("minute", d.getMinutes());
          component.assign("meridiem", d.getHours() >= 12 ? 1 : 0);
        }
        return component;
      },
    });
  }

  const plusDays = (ref: Date, n: number) => {
    const d = new Date(ref);
    d.setDate(d.getDate() + n);
    return d;
  };

  // ── Multi-word relative phrases ─────────────────────────────────────────

  addParser(/\bday after tomorrow\b/i, (ctx) => plusDays(ctx.refDate, 2));
  addParser(/\bday before yesterday\b/i, (ctx) => plusDays(ctx.refDate, -2));
  addParser(/\b(?:tmr|tmw|2moro|2morrow)\b/i, (ctx) =>
    plusDays(ctx.refDate, 1),
  );

  // "next week" is next Monday, like the "Next week" quick date.
  addParser(/\bnext\s+week\b/i, (ctx) =>
    plusDays(ctx.refDate, (8 - ctx.refDate.getDay()) % 7 || 7),
  );

  // "the 1st", "by the 31st": the next such day of the month, skipping
  // months that don't have it. "the 3rd of October" is chrono's already.
  // Only where nothing follows but a time or the end, so "the 2nd floor"
  // and "the 1st draft" stay words.
  const ORDINAL_DAY =
    /\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b(?=\s*$|\s*[,.;!?]|\s+(?:at|by|before|from|@)\b|\s+\d)/i;
  addParser(ORDINAL_DAY, (ctx, m) => {
    const day = Number(m[1]);
    if (day < 1 || day > 31) return null;
    const ref = ctx.refDate;
    for (let i = 0; i < 13; i++) {
      const d = new Date(ref.getFullYear(), ref.getMonth() + i, day);
      if (d.getDate() !== day) continue;
      if (i === 0 && day < ref.getDate()) continue;
      return d;
    }
    return null;
  });

  // End of the working day: 5pm today, or the end of today once that's gone.
  addParser(
    /\b(?:eod|cob|end\s+of\s+(?:the\s+)?(?:work(?:ing)?\s*)?day|close\s+of\s+business)\b/i,
    (ctx) => {
      const d = new Date(ctx.refDate);
      if (d.getHours() >= 17) d.setHours(23, 59, 0, 0);
      else d.setHours(17, 0, 0, 0);
      return d;
    },
    { timeOnly: true },
  );

  // ── Named dates / holidays ──────────────────────────────────────────────

  const NAMED_DATES: Record<string, { month: number; day: number }> = {
    christmas: { month: 12, day: 25 },
    "christmas eve": { month: 12, day: 24 },
    "new years eve": { month: 12, day: 31 },
    "new year's eve": { month: 12, day: 31 },
    "new year": { month: 1, day: 1 },
    "new years": { month: 1, day: 1 },
    "new year's": { month: 1, day: 1 },
    "valentines day": { month: 2, day: 14 },
    halloween: { month: 10, day: 31 },
    "independence day": { month: 7, day: 4 },
    "july 4th": { month: 7, day: 4 },
  };

  const namedDateRegex = new RegExp(
    `\\b(?:${Object.keys(NAMED_DATES)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b`,
    "i",
  );

  addParser(namedDateRegex, (ctx, m) => {
    const { month, day } = NAMED_DATES[m[0].toLowerCase()];
    const year = ctx.refDate.getFullYear();
    const target = new Date(year, month - 1, day);
    // If the date already passed this year, use next year
    if (target < ctx.refDate) target.setFullYear(year + 1);
    return target;
  });

  // ── End-of-period phrases ───────────────────────────────────────────────

  addParser(/\b(?:eow|end of (?:the )?week)\b/i, (ctx) => {
    const d = new Date(ctx.refDate);
    return plusDays(d, (6 - d.getDay() + 7) % 7 || 7);
  });

  addParser(/\bend of (?:the )?month\b/i, (ctx) => {
    const d = new Date(ctx.refDate);
    d.setMonth(d.getMonth() + 1, 0); // last day of current month
    return d;
  });

  addParser(
    /\bend of (?:the )?year\b/i,
    (ctx) => new Date(ctx.refDate.getFullYear(), 11, 31),
  );
}
