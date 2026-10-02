/**
 * Turns what a speech recogniser hears into text the capture parser reads.
 * Recognisers rarely punctuate and spell numbers as words, so "buy milk
 * call mom at five" would save as one task with no time. Voice input only:
 * typed text never passes through here.
 *
 * Pauses become sentence breaks (only where the next words start an item),
 * so the user sees the split in the text box and can edit it; the capture
 * router does the actual splitting, exactly as for typed text.
 */
import {
  INCOMPLETE_END,
  PUT_AWAY,
  TASK_VERB_RE,
  THOUGHT_LEAD,
} from "@/lib/capture-router";
import { stripLeadIn } from "@/lib/nlp/parse-task-text";

// ─── Number words ───────────────────────────────────────────────────────────

const UNITS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};
const NUMBER_WORD = `(?:(?:${Object.keys(TENS).join("|")})(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?|${[...UNITS].reverse().join("|")}|\\d{1,2})`;

/** "forty five" → 45, "7" → 7; null for anything else. */
function toNumber(word: string): number | null {
  const w = word.toLowerCase().trim();
  if (/^\d+$/.test(w)) return Number(w);
  const [tens, unit] = w.split(/[\s-]+/);
  if (tens in TENS) {
    const u = unit ? UNITS.indexOf(unit) : 0;
    return u >= 0 && u < 10 ? TENS[tens] + u : null;
  }
  const i = UNITS.indexOf(w);
  return i >= 0 ? i : null;
}

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
  "twentieth",
];
const suffix = (n: number) =>
  n % 10 === 1 && n !== 11
    ? "st"
    : n % 10 === 2 && n !== 12
      ? "nd"
      : n % 10 === 3 && n !== 13
        ? "rd"
        : "th";

/** "first" → 1, "twenty third" → 23, "thirtieth" → 30, up to 31. */
function ordinalToNumber(word: string): number | null {
  const w = word.toLowerCase().trim();
  const i = ORDINALS.indexOf(w);
  if (i >= 0) return i + 1;
  if (w === "thirtieth") return 30;
  const m = w.match(/^(twenty|thirty)[\s-](\w+)$/);
  if (!m) return null;
  const u = ORDINALS.indexOf(m[2]);
  const n = TENS[m[1]] + u + 1;
  return u >= 0 && u < 9 && n <= 31 ? n : null;
}
const ORDINAL_WORD = `(?:(?:twenty|thirty)[\\s-](?:${ORDINALS.slice(0, 9).join("|")})|thirtieth|${[...ORDINALS].reverse().join("|")})`;

// ─── Rules ──────────────────────────────────────────────────────────────────

/** Marks a forced break ("next task") until segments are joined. */
const BREAK = "\u0001";

const SPOKEN_BREAK =
  /(?:^|[\s,.]+)(?:next\s+(?:task|item|one)|new\s+(?:task|item|line)|full\s+stop)(?=[\s,.]|$)[\s,.]*/gi;

const PRIORITY = new RegExp(
  `\\b(?:priority|p)\\s+(one|two|three|four|[1-4])\\b`,
  "gi",
);

const TIME = new RegExp(
  `\\b(at|by|from|until|till|around|before|after)\\s+(${NUMBER_WORD})(?:\\s+(o['’]?clock|${NUMBER_WORD}))?(?=\\s*(?:am|pm)?\\b)`,
  "gi",
);

const DURATION_HOURS = new RegExp(
  `\\b(an?|${NUMBER_WORD})\\s+hours?(\\s+and\\s+a\\s+half)?(?:\\s+(?:and\\s+)?(${NUMBER_WORD})\\s+minutes?)?\\b`,
  "gi",
);
const HALF_HOUR = /\b(?:half\s+an|a\s+half)\s+hour\b/gi;
const DURATION_MINUTES = new RegExp(`\\b(${NUMBER_WORD})\\s+minutes?\\b`, "gi");

const ORDINAL_DATE = new RegExp(
  `\\b(on\\s+the|the)\\s+(${ORDINAL_WORD})(?=\\s+of\\b|\\s*$|\\s+(?:every|each)\\b)`,
  "gi",
);

const HASHTAG =
  /\b(?:hashtag|hash\s+tag|tag)\s+((?:[\p{L}\p{N}_-]+\s*){1,3})/giu;
const tagKey = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Rewrites one stretch of speech: "priority one" → "p1", "hashtag work" →
 * "#work" (only for one of `categories`), "at three thirty" → "at 3:30",
 * "an hour and a half" → "1 hour 30 minutes", "on the first of" → "on the
 * 1st of", "p.m." → "pm", and "next task" / "full stop" → a forced break.
 */
export function normaliseSpoken(text: string, categories: string[]): string {
  const byKey = new Map(categories.map((c) => [tagKey(c), c]));
  return text
    .replace(
      /\b([ap])\.\s?m\.?(?=\s|$|[,;!?])/gi,
      (_, l: string) => `${l.toLowerCase()}m`,
    )
    .replace(SPOKEN_BREAK, ` ${BREAK} `)
    .replace(PRIORITY, (m, n: string) => {
      const level = toNumber(n);
      return level && level <= 4 ? `p${level}` : m;
    })
    .replace(HASHTAG, (m, words: string) => {
      // Longest run of words that names a category: "side project".
      const parts = words.trim().split(/\s+/);
      for (let k = parts.length; k > 0; k--) {
        const category = byKey.get(tagKey(parts.slice(0, k).join(" ")));
        if (category) {
          const rest = parts.slice(k).join(" ");
          return `#${category.replace(/\s+/g, "-")}${rest ? ` ${rest}` : ""} `;
        }
      }
      return m;
    })
    .replace(TIME, (m, prep: string, h: string, mins?: string) => {
      const hour = toNumber(h);
      if (hour === null || hour < 1 || hour > 12) return m;
      if (!mins || /clock/i.test(mins)) return `${prep} ${hour}`;
      const minute = toNumber(mins);
      if (minute === null || minute > 59) return m;
      return `${prep} ${hour}:${String(minute).padStart(2, "0")}`;
    })
    .replace(HALF_HOUR, "30 minutes")
    .replace(DURATION_HOURS, (m, h: string, half?: string, mins?: string) => {
      const hours = /^an?$/i.test(h) ? 1 : toNumber(h);
      if (hours === null || hours < 1 || hours > 24) return m;
      const minutes = half ? 30 : mins ? toNumber(mins) : 0;
      if (minutes === null || minutes > 59) return m;
      const unit = hours === 1 ? "hour" : "hours";
      return minutes
        ? `${hours} ${unit} ${minutes} minutes`
        : `${hours} ${unit}`;
    })
    .replace(DURATION_MINUTES, (m, n: string) => {
      const minutes = toNumber(n);
      return minutes === null || minutes < 1 ? m : `${minutes} minutes`;
    })
    .replace(ORDINAL_DATE, (m, pre: string, word: string) => {
      const n = ordinalToNumber(word);
      return n ? `${pre} ${n}${suffix(n)}` : m;
    })
    .replace(/[ \t]+/g, " ")
    .trim();
}

// ─── Joining segments ───────────────────────────────────────────────────────

/** Does this stretch of speech begin a new item of its own? */
function startsItem(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const stripped = stripLeadIn(t);
  return (
    stripped !== t ||
    TASK_VERB_RE.test(stripped) ||
    THOUGHT_LEAD.test(t) ||
    PUT_AWAY.test(t)
  );
}

const AND_THEN = /\s+and\s+then\s+/i;
const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

interface Piece {
  text: string;
  /** The words that joined it to the previous piece, if not a pause. */
  glue: string;
  forced: boolean;
}

/**
 * Joins the recogniser's segments (one per pause, the last possibly still
 * in progress) into one capture. A pause becomes ". " only when the next
 * words start an item and the previous ones don't trail off ("remind me
 * to | call mom" stays one); "next task" always breaks; "and then" breaks
 * like a pause.
 */
export function joinSpokenSegments(
  segments: string[],
  categories: string[],
): string {
  const pieces: Piece[] = [];
  for (const segment of segments) {
    normaliseSpoken(segment, categories)
      .split(BREAK)
      .forEach((chunk, i) => {
        chunk.split(AND_THEN).forEach((text, j) =>
          pieces.push({
            text: text.trim(),
            glue: j > 0 ? " and then " : " ",
            forced: i > 0 && j === 0,
          }),
        );
      });
  }

  let out = "";
  let forceNext = false;
  for (const piece of pieces) {
    if (!piece.text) {
      forceNext ||= piece.forced;
      continue;
    }
    const forced = forceNext || piece.forced;
    forceNext = false;
    if (!out) {
      out = piece.text;
    } else if (
      forced ||
      (startsItem(piece.text) && !INCOMPLETE_END.test(out.trim()))
    ) {
      out = `${out.replace(/[\s,;:.]+$/, "")}. ${capitalise(piece.text)}`;
    } else {
      out = `${out}${piece.glue}${piece.text}`;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}
