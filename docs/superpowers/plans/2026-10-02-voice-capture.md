# Voice Capture Understanding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make speech that's spoken into Quick Capture and Mind Sweep come out as the right separate items, each with the right date, repeat, priority, duration and category. It stays instant, free and private by default.

**Architecture:** The browser's speech recogniser reports one segment per pause. A new pure module, `src/lib/nlp/spoken.ts`, normalises spoken wording ("priority one" → `p1`, "at three thirty" → `at 3:30`). It then joins the segments with a visible `. ` wherever the next words start a new item. The existing capture router splits and parses that text exactly as it does typed text. `useSpeechCapture` is hardened: no Android duplicates, on-device recognition when installed, category hint phrases, a silence timeout, and hidden in iOS home-screen apps.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict, Web Speech API, chrono-node (already lazy-loaded), Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-02-voice-capture-design.md`

**Provenance:** All code below was prototyped on 2026-10-02 and run against the repo before this plan was written. It gave tsc clean, 0 lint errors, and 763 / 763 tests passing (64 files). The regression set was mutation-checked: two broken expectations were both caught. The code here is that exact code, not a sketch.

## Global Constraints

- No new dependencies. `package.json` and `package-lock.json` stay unchanged.
- Rules only, no AI provider. Nothing leaves the device beyond what the browser's recogniser already does.
- Voice-only rewriting: `normaliseSpoken` / `joinSpokenSegments` are never applied to typed text.
- Priority comes only from an explicit spoken marker ("priority one", "p two"). "urgent" / "important" are never mapped.
- `#category` comes only from one of the user's own categories (`userSettings.do_categories ?? DEFAULT_DO_CATEGORIES`).
- Never call `SpeechRecognition.install()` and never trigger a language-pack download.
- Nothing saves on its own. Voice fills the text box, and the user saves as today.
- Working tree is CRLF. Run `npx prettier --write <only the files you touched>`, never a whole folder. Prettier/lint-staged on commit handles the rest. Running it on a folder rewrites line endings in unrelated files.
- Before finishing: `npm run lint` (0 errors), `npx tsc --noEmit`, `npm test`, `npm run build`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

| File | Change | Responsibility |
|---|---|---|
| `src/lib/capture-router.ts` | Modify (4 lines) | Export `TASK_VERB_RE`, `INCOMPLETE_END`, `THOUGHT_LEAD`, `PUT_AWAY` for reuse |
| `src/lib/nlp/spoken.ts` | Create | `normaliseSpoken(text, categories)`, `joinSpokenSegments(segments, categories)` |
| `src/lib/__tests__/spoken.test.ts` | Create | Unit tests: every rewrite plus the words that must stay words |
| `src/lib/__tests__/fixtures/spoken-captures.ts` | Create | Regression set of recogniser-style captures with expected items |
| `src/lib/__tests__/spoken-captures.test.ts` | Create | Runs the set end to end through `routeCapture` with the clock pinned |
| `src/hooks/useSpeechCapture.ts` | Rewrite | Segments, Android de-dupe, on-device, hint phrases, silence stop, iOS standalone gate |
| `src/hooks/__tests__/useSpeechCapture.test.ts` | Create | Hook tests against a fake recogniser |
| `src/components/features/CaptureModal.tsx` | Modify | `onSegments` → `joinSpokenSegments`, pass categories as phrases |
| `src/components/features/MindSweep.tsx` | Modify | Same as CaptureModal |
| `src/components/features/__tests__/CaptureModal.test.tsx` | Modify | One integration test: two spoken pauses → `buy milk. Call mom at 5` |
| `CLAUDE.md` | Modify | Verified-state table: new test counts |

---

### Task 1: Speech normaliser and segment joiner

**Files:**
- Modify: `src/lib/capture-router.ts:211,229,251,256`
- Create: `src/lib/nlp/spoken.ts`
- Test: `src/lib/__tests__/spoken.test.ts`

**Interfaces:**
- Consumes: `stripLeadIn(text: string): string` from `src/lib/nlp/parse-task-text.ts` (already exported).
- Produces:
  - `export function normaliseSpoken(text: string, categories: string[]): string`
  - `export function joinSpokenSegments(segments: string[], categories: string[]): string`
  - From `capture-router.ts`: `export const TASK_VERB_RE: RegExp`, `INCOMPLETE_END: RegExp`, `THOUGHT_LEAD: RegExp`, `PUT_AWAY: RegExp`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/spoken.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { joinSpokenSegments, normaliseSpoken } from "@/lib/nlp/spoken";

const categories = ["Work", "Health", "Side project"];
const n = (text: string) => normaliseSpoken(text, categories);
const join = (...segments: string[]) =>
  joinSpokenSegments(segments, categories);

describe("normaliseSpoken", () => {
  it.each([
    ["finish it priority one", "finish it p1"],
    ["finish it p two", "finish it p2"],
    ["finish it priority 3", "finish it p3"],
    ["gym hashtag health", "gym #Health"],
    ["gym tag work tomorrow", "gym #Work tomorrow"],
    ["plan hashtag side project", "plan #Side-project"],
    ["call at three thirty", "call at 3:30"],
    ["call at five", "call at 5"],
    ["call at five o'clock", "call at 5"],
    ["call by eleven forty five", "call by 11:45"],
    ["call at 3 p.m.", "call at 3 pm"],
    ["call at 9 a.m. tomorrow", "call at 9 am tomorrow"],
    ["write it an hour and a half", "write it 1 hour 30 minutes"],
    ["write it for half an hour", "write it for 30 minutes"],
    ["write it two hours", "write it 2 hours"],
    ["write it thirty minutes", "write it 30 minutes"],
    ["write it forty five minutes", "write it 45 minutes"],
    [
      "pay rent on the first of every month",
      "pay rent on the 1st of every month",
    ],
    ["pay rent on the twenty third", "pay rent on the 23rd"],
  ])("%s → %s", (spoken, expected) => {
    expect(n(spoken)).toBe(expected);
  });

  it.each([
    ["urgent call the bank", "urgent call the bank"],
    ["important email boss", "important email boss"],
    ["gym hashtag cardio", "gym hashtag cardio"],
    ["the trial period ends friday", "the trial period ends friday"],
    ["read chapter one of the book", "read chapter one of the book"],
    ["review the second draft", "review the second draft"],
    ["spend half the budget", "spend half the budget"],
    ["meet at thirteen", "meet at thirteen"],
  ])("leaves %s alone", (spoken, expected) => {
    expect(n(spoken)).toBe(expected);
  });
});

describe("joinSpokenSegments", () => {
  it("breaks at a pause before a new item", () => {
    expect(join("buy milk", "call mom", "email john tomorrow")).toBe(
      "buy milk. Call mom. Email john tomorrow",
    );
  });

  it("joins a pause that doesn't start an item", () => {
    expect(join("call sarah about the", "budget for the offsite")).toBe(
      "call sarah about the budget for the offsite",
    );
    expect(join("call the dentist", "tomorrow at five")).toBe(
      "call the dentist tomorrow at 5",
    );
  });

  it("joins when the words before the pause trail off", () => {
    expect(join("remind me to", "call mom")).toBe("remind me to call mom");
  });

  it("breaks on a lead-in after a pause", () => {
    expect(join("meeting at two", "need to prepare slides")).toBe(
      "meeting at 2. Need to prepare slides",
    );
  });

  it("always breaks on a spoken 'next task'", () => {
    expect(join("buy milk next task eggs next task bread")).toBe(
      "buy milk. Eggs. Bread",
    );
    expect(join("buy milk next task", "eggs")).toBe("buy milk. Eggs");
  });

  it("breaks on 'and then' before a new item, and only then", () => {
    expect(join("buy milk and then call mom")).toBe("buy milk. Call mom");
    expect(join("wait and then decide")).toBe("wait and then decide");
  });

  it("breaks after a time said with p.m.", () => {
    expect(join("dentist at 3 p.m.", "pick up the kids")).toBe(
      "dentist at 3 pm. Pick up the kids",
    );
  });

  it("returns an empty string for silence", () => {
    expect(join()).toBe("");
    expect(join("  ", "next task")).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/spoken.test.ts`
Expected: FAIL. The import of `@/lib/nlp/spoken` doesn't resolve ("Failed to resolve import").

- [ ] **Step 3: Export the four router regexes**

In `src/lib/capture-router.ts`, add `export` to these four declarations. Change nothing else.

```diff
-const TASK_VERB_RE = new RegExp(`^${words(TASK_VERBS).source}`, "i");
+export const TASK_VERB_RE = new RegExp(`^${words(TASK_VERBS).source}`, "i");
@@
-const INCOMPLETE_END =
+export const INCOMPLETE_END =
@@
-const THOUGHT_LEAD =
+export const THOUGHT_LEAD =
@@
-const PUT_AWAY =
+export const PUT_AWAY =
```

- [ ] **Step 4: Create `src/lib/nlp/spoken.ts`**

```ts
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
```

Design notes for the reviewer:
- The rewrites run in a fixed order. `p.m.` → `pm` runs first, because otherwise `SENTENCE_BREAK` in the router refuses to split after `p.m.` (its lookbehind excludes `[ap].m`). Hashtags run before times, so "tag work at five" works.
- `TIME` only fires after `at|by|from|until|till|around|before|after`, and only for hours 1–12. So "meet at thirteen" and "read chapter one" stay as words.
- `ORDINAL_DATE` only fires before "of", "every"/"each", or at the end. So "the second draft" stays.
- "period" is **not** a spoken break (spec deviation, deliberate): "the trial period ends friday" would split.
- `AND_THEN` splits like a pause: it breaks only when the next words start an item ("wait and then decide" stays whole).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/spoken.test.ts src/lib/__tests__/capture-router.test.ts src/lib/__tests__/parse-task-text.test.ts`
Expected: PASS. 35 new tests, plus the 184 existing router and parser tests unchanged.

- [ ] **Step 6: Typecheck, lint, format only these files**

```bash
npx prettier --write src/lib/nlp/spoken.ts src/lib/__tests__/spoken.test.ts src/lib/capture-router.ts
npx tsc --noEmit
npx eslint src/lib/nlp/spoken.ts src/lib/capture-router.ts src/lib/__tests__/spoken.test.ts
```
Expected: no output from tsc and no eslint errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/nlp/spoken.ts src/lib/__tests__/spoken.test.ts src/lib/capture-router.ts
git commit -m "feat(voice): read spoken wording and turn pauses into item breaks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Spoken-capture regression set

**Files:**
- Create: `src/lib/__tests__/fixtures/spoken-captures.ts`
- Test: `src/lib/__tests__/spoken-captures.test.ts`

**Interfaces:**
- Consumes: `joinSpokenSegments` (Task 1); `routeCapture(text, settings): Promise<RoutedItem[]>` and `type RoutedItem` from `src/lib/capture-router.ts`.
- Produces: `SPOKEN_CAPTURES: SpokenCase[]`, `SPOKEN_NOW: Date`, `SPOKEN_CATEGORIES: string[]`, `ExpectedItem`, `SpokenCase`. Future voice changes add cases here.

This is a regression set of known phrasings. It is not an accuracy estimate: a deterministic parser always passes cases written for it. Real-speech accuracy is measured in Task 4.

- [ ] **Step 1: Create the fixtures**

Create `src/lib/__tests__/fixtures/spoken-captures.ts`:

```ts
/**
 * Brain dumps as speech recognisers deliver them: lowercase, no
 * punctuation, one string per pause. The clock is pinned to Monday
 * 5 October 2026, 10:00 local time. `due` is local "yyyy-MM-dd HH:mm"
 * (a date with no time is due 23:59).
 */
export interface ExpectedItem {
  type: "task" | "location" | "thought" | "unknown";
  title: string;
  due?: string;
  recurrence?: string;
  priority?: 1 | 2 | 3 | 4;
  estimateMinutes?: number;
  category?: string;
}
export interface SpokenCase {
  segments: string[];
  items: ExpectedItem[];
}

export const SPOKEN_NOW = new Date(2026, 9, 5, 10, 0);
export const SPOKEN_CATEGORIES = ["Work", "Health", "Home", "Side project"];

export const SPOKEN_CAPTURES: SpokenCase[] = [
  // ── Several items in one breath ──
  {
    segments: ["buy milk", "call mom", "email john tomorrow"],
    items: [
      { type: "task", title: "Buy milk" },
      { type: "task", title: "Call mom" },
      { type: "task", title: "Email john", due: "2026-10-06 23:59" },
    ],
  },
  {
    segments: ["buy milk and then call mom tonight"],
    items: [
      { type: "task", title: "Buy milk" },
      { type: "task", title: "Call mom", due: "2026-10-05 21:00" },
    ],
  },
  {
    segments: ["buy milk next task eggs next task bread"],
    items: [
      { type: "task", title: "Buy milk" },
      { type: "unknown", title: "Eggs" },
      { type: "unknown", title: "Bread" },
    ],
  },
  {
    segments: ["meeting with john at two tomorrow", "need to prepare slides"],
    items: [
      { type: "task", title: "Meeting with john", due: "2026-10-06 14:00" },
      { type: "task", title: "Prepare slides" },
    ],
  },
  {
    segments: [
      "i left my keys in the kitchen drawer",
      "book the car service next week",
    ],
    items: [
      { type: "location", title: "kitchen drawer" },
      {
        type: "task",
        title: "Book the car service",
        due: "2026-10-12 23:59",
      },
    ],
  },
  {
    segments: ["idea what if the app had a widget", "buy stamps"],
    items: [
      { type: "thought", title: "idea what if the app had a widget" },
      { type: "task", title: "Buy stamps" },
    ],
  },
  {
    segments: ["pay the electricity bill", "renew my passport by friday"],
    items: [
      { type: "task", title: "Pay the electricity bill" },
      { type: "task", title: "Renew my passport", due: "2026-10-09 23:59" },
    ],
  },
  {
    segments: [
      "dentist at 3 p.m. on thursday",
      "pick up the dry cleaning",
      "text sarah happy birthday",
    ],
    items: [
      { type: "task", title: "Dentist", due: "2026-10-08 15:00" },
      { type: "task", title: "Pick up the dry cleaning" },
      { type: "task", title: "Text sarah happy birthday" },
    ],
  },

  // ── One item across pauses ──
  {
    segments: ["remind me to", "water the plants every other day"],
    items: [
      {
        type: "task",
        title: "Water the plants",
        due: "2026-10-05 23:59",
        recurrence: "FREQ=DAILY;INTERVAL=2",
      },
    ],
  },
  {
    segments: ["call sarah about the", "budget for the q3 offsite"],
    items: [
      { type: "task", title: "Call sarah about the budget for the q3 offsite" },
    ],
  },
  {
    segments: ["call the dentist", "tomorrow at five"],
    items: [
      { type: "task", title: "Call the dentist", due: "2026-10-06 17:00" },
    ],
  },

  // ── Spoken times ──
  {
    segments: ["call the dentist tomorrow at three thirty"],
    items: [
      { type: "task", title: "Call the dentist", due: "2026-10-06 15:30" },
    ],
  },
  {
    segments: ["submit expenses at five o'clock tomorrow"],
    items: [
      { type: "task", title: "Submit expenses", due: "2026-10-06 17:00" },
    ],
  },
  {
    segments: ["book flights next tuesday at noon"],
    items: [{ type: "task", title: "Book flights", due: "2026-10-13 12:00" }],
  },
  {
    segments: ["call the bank at 9 a.m. tomorrow"],
    items: [{ type: "task", title: "Call the bank", due: "2026-10-06 09:00" }],
  },

  // ── Repeats ──
  {
    segments: ["pay rent on the first of every month"],
    items: [
      {
        type: "task",
        title: "Pay rent",
        due: "2026-11-01 23:59",
        recurrence: "FREQ=MONTHLY;BYMONTHDAY=1",
      },
    ],
  },
  {
    segments: ["take out the bins every tuesday evening"],
    items: [
      {
        type: "task",
        title: "Take out the bins",
        due: "2026-10-06 18:00",
        recurrence: "FREQ=WEEKLY;BYDAY=TU",
      },
    ],
  },

  // ── Priority, category, duration ──
  {
    segments: ["finish the report by friday priority one"],
    items: [
      {
        type: "task",
        title: "Finish the report",
        due: "2026-10-09 23:59",
        priority: 1,
      },
    ],
  },
  {
    segments: ["gym hashtag health tomorrow morning"],
    items: [
      {
        type: "task",
        title: "Gym",
        due: "2026-10-06 09:00",
        category: "Health",
      },
    ],
  },
  {
    segments: ["write the proposal an hour and a half hashtag work"],
    items: [
      {
        type: "task",
        title: "Write the proposal",
        estimateMinutes: 90,
        category: "Work",
      },
    ],
  },
  {
    segments: [
      "sketch the landing page forty five minutes hashtag side project",
    ],
    items: [
      {
        type: "task",
        title: "Sketch the landing page",
        estimateMinutes: 45,
        category: "Side project",
      },
    ],
  },

  // ── Words that must stay words ──
  {
    segments: ["urgent call the bank"],
    items: [{ type: "task", title: "Urgent call the bank" }],
  },
  {
    segments: ["read chapter one of the book"],
    items: [{ type: "task", title: "Read chapter one of the book" }],
  },
  {
    segments: ["review the second draft of the essay"],
    items: [{ type: "task", title: "Review the second draft of the essay" }],
  },
];
```

- [ ] **Step 2: Create the end-to-end test**

Create `src/lib/__tests__/spoken-captures.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { format } from "date-fns";
import { routeCapture, type RoutedItem } from "@/lib/capture-router";
import { joinSpokenSegments } from "@/lib/nlp/spoken";
import {
  SPOKEN_CAPTURES,
  SPOKEN_CATEGORIES,
  SPOKEN_NOW,
  type ExpectedItem,
} from "./fixtures/spoken-captures";

const settings = {
  nlp_date_parsing: true,
  smart_routing_enabled: true,
  do_categories: SPOKEN_CATEGORIES,
};

/** The routed item in the fixture's shape, keeping only what was expected. */
function actual(item: RoutedItem, expected: ExpectedItem): ExpectedItem {
  const out: ExpectedItem = { type: item.type, title: item.title };
  if ("due" in expected || item.deadline)
    out.due = item.deadline
      ? format(new Date(item.deadline), "yyyy-MM-dd HH:mm")
      : undefined;
  if ("recurrence" in expected || item.recurrence)
    out.recurrence = item.recurrence ?? undefined;
  if ("priority" in expected || item.priority)
    out.priority = item.priority ?? undefined;
  if ("estimateMinutes" in expected || item.estimateMinutes)
    out.estimateMinutes = item.estimateMinutes ?? undefined;
  if ("category" in expected || item.category)
    out.category = item.category ?? undefined;
  return out;
}

describe("spoken captures, end to end", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SPOKEN_NOW);
  });
  afterAll(() => vi.useRealTimers());

  it.each(SPOKEN_CAPTURES.map((c) => [c.segments.join(" | "), c] as const))(
    "%s",
    async (_, { segments, items }) => {
      const text = joinSpokenSegments(segments, SPOKEN_CATEGORIES);
      const routed = await routeCapture(text, settings);
      expect(routed.map((r, i) => actual(r, items[i] ?? r))).toEqual(items);
    },
  );
});
```

`vi.useFakeTimers({ toFake: ["Date"] })` pins only `Date`, so chrono's "tomorrow" is stable, while promises and the lazy `import("chrono-node")` still run.

- [ ] **Step 3: Run it**

Run: `npx vitest run src/lib/__tests__/spoken-captures.test.ts`
Expected: PASS, 24 tests.

- [ ] **Step 4: Prove it can fail**

Temporarily change `due: "2026-10-06 15:30"` to `"2026-10-06 03:30"` in the fixtures and re-run.
Expected: 1 failed ("call the dentist tomorrow at three thirty"). Revert the change and re-run: 24 pass.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write src/lib/__tests__/fixtures/spoken-captures.ts src/lib/__tests__/spoken-captures.test.ts
git add src/lib/__tests__/fixtures/spoken-captures.ts src/lib/__tests__/spoken-captures.test.ts
git commit -m "test(voice): regression set of spoken brain dumps, end to end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Harden `useSpeechCapture` and wire both capture surfaces

The hook's callback changes from `onTranscript(text)` to `onSegments(segments)`, so the hook and its two callers change together. Otherwise the tree doesn't compile between commits.

**Files:**
- Rewrite: `src/hooks/useSpeechCapture.ts`
- Test: `src/hooks/__tests__/useSpeechCapture.test.ts`
- Modify: `src/components/features/CaptureModal.tsx:46,361-368`
- Modify: `src/components/features/MindSweep.tsx:12,51-53`
- Modify: `src/components/features/__tests__/CaptureModal.test.tsx` (one test after "adds what you say after what you typed")

**Interfaces:**
- Consumes: `joinSpokenSegments` (Task 1); `DEFAULT_DO_CATEGORIES` from `src/lib/constants.ts`.
- Produces:
  - `useSpeechCapture({ onSegments: (segments: string[]) => void; onError?: (e: SpeechError) => void; phrases?: string[] }): { supported: boolean; listening: boolean; start(): void; stop(): void }`
  - `export function readSegments(results: ArrayLike<RecognitionResult>): string[]`
  - `export const SILENCE_MS = 8000`
  - `SpeechError` is unchanged.

- [ ] **Step 1: Write the failing hook tests**

Create `src/hooks/__tests__/useSpeechCapture.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  readSegments,
  SILENCE_MS,
  useSpeechCapture,
} from "@/hooks/useSpeechCapture";

type Result = { isFinal: boolean; 0: { transcript: string } };
const result = (transcript: string, isFinal = true): Result => ({
  isFinal,
  0: { transcript },
});

const instances: FakeRecognition[] = [];
class FakeRecognition {
  static available?: ReturnType<typeof vi.fn>;
  lang = "";
  continuous = false;
  interimResults = false;
  processLocally = false;
  phrases: unknown[] = [];
  onresult: ((e: { resultIndex: number; results: Result[] }) => void) | null =
    null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    instances.push(this);
  }
}
class FakePhrase {
  constructor(
    public phrase: string,
    public boost: number,
  ) {}
}

const win = window as unknown as Record<string, unknown>;
function install({ available }: { available?: string } = {}) {
  FakeRecognition.available = available
    ? vi.fn().mockResolvedValue(available)
    : undefined;
  win.webkitSpeechRecognition = FakeRecognition;
}

afterEach(() => {
  delete win.webkitSpeechRecognition;
  delete win.SpeechRecognitionPhrase;
  instances.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("readSegments", () => {
  it("keeps one string per pause", () => {
    expect(
      readSegments([result("buy milk "), result(" call  mom", false)]),
    ).toEqual(["buy milk", "call mom"]);
  });

  it("drops Android's restated results", () => {
    expect(
      readSegments([
        result("buy"),
        result("buy milk"),
        result("buy milk call mom", false),
      ]),
    ).toEqual(["buy milk call mom"]);
  });

  it("skips empty results", () => {
    expect(readSegments([result("  "), result("eggs")])).toEqual(["eggs"]);
  });
});

describe("useSpeechCapture", () => {
  it("reports every pause as its own segment", () => {
    install();
    const onSegments = vi.fn();
    const { result: hook } = renderHook(() => useSpeechCapture({ onSegments }));
    act(() => hook.current.start());
    act(() =>
      instances[0].onresult?.({
        resultIndex: 1,
        results: [result("buy milk"), result("call mom", false)],
      }),
    );
    expect(onSegments).toHaveBeenLastCalledWith(["buy milk", "call mom"]);
  });

  it("recognises on the device when the language is installed", async () => {
    install({ available: "available" });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    await waitFor(() =>
      expect(FakeRecognition.available).toHaveBeenCalledWith({
        langs: [navigator.language || "en-US"],
        processLocally: true,
      }),
    );
    await act(async () => {});
    act(() => hook.current.start());
    expect(instances[0].processLocally).toBe(true);
  });

  it("never asks for a download when the language isn't installed", async () => {
    install({ available: "downloadable" });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    await act(async () => {});
    act(() => hook.current.start());
    expect(instances[0].processLocally).toBe(false);
  });

  it("hints the user's words, and retries without them if refused", () => {
    install();
    win.SpeechRecognitionPhrase = FakePhrase;
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn(), phrases: ["Work", "Health"] }),
    );
    act(() => hook.current.start());
    expect(instances[0].phrases).toEqual([
      new FakePhrase("Work", 3),
      new FakePhrase("Health", 3),
    ]);

    act(() => {
      instances[0].onerror?.({ error: "phrases-not-supported" });
      instances[0].onend?.();
    });
    expect(instances).toHaveLength(2);
    expect(instances[1].start).toHaveBeenCalled();
    expect(instances[1].phrases).toEqual([]);
    expect(hook.current.listening).toBe(true);
  });

  it("stops after a silence", () => {
    vi.useFakeTimers();
    install();
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    act(() => hook.current.start());
    act(() => vi.advanceTimersByTime(SILENCE_MS - 1000));
    act(() =>
      instances[0].onresult?.({ resultIndex: 0, results: [result("eggs")] }),
    );
    act(() => vi.advanceTimersByTime(SILENCE_MS - 1000));
    expect(instances[0].stop).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(instances[0].stop).toHaveBeenCalled();
    expect(hook.current.listening).toBe(false);
  });

  it("is unsupported in an installed iPhone home-screen app", () => {
    install();
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      standalone: true,
    });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    expect(hook.current.supported).toBe(false);
  });

  it("is supported in iPhone Safari itself", () => {
    install();
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      standalone: false,
    });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    expect(hook.current.supported).toBe(true);
  });

  it("maps a blocked microphone to 'denied'", () => {
    install();
    const onError = vi.fn();
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn(), onError }),
    );
    act(() => hook.current.start());
    act(() => instances[0].onerror?.({ error: "not-allowed" }));
    expect(onError).toHaveBeenCalledWith("denied");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/hooks/__tests__/useSpeechCapture.test.ts`
Expected: FAIL. `readSegments` / `SILENCE_MS` aren't exported, and `onSegments` is never called.

- [ ] **Step 3: Rewrite `src/hooks/useSpeechCapture.ts`**

```ts
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Voice capture through the browser's own speech recognition (Chrome, Edge,
 * Safari). Speaking was about 3x faster than typing on a phone in Ruan et
 * al.; voice sits next to the keyboard, never instead of it.
 *
 * Firefox has no recognition API, and Safari's breaks inside an installed
 * iOS home-screen app, so `supported` is false there and callers hide the
 * button (the iOS keyboard's own dictation key still works). Chrome
 * recognises on the device when the language pack is already installed;
 * otherwise it sends audio to Google, and Safari to Apple. Nothing is
 * recorded or stored by Presense.
 */

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  phrases?: unknown[];
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Availability =
  "available" | "downloadable" | "downloading" | "unavailable";
interface RecognitionCtor {
  new (): Recognition;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<Availability>;
}
type PhraseCtor = new (phrase: string, boost: number) => unknown;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** An installed home-screen app on iPhone/iPad, where recognition breaks. */
function isIosStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios =
    /iP(?:hone|ad|od)/.test(nav.userAgent) ||
    (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
  if (!ios) return false;
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

const recognitionLang = () => navigator.language || "en-US";

/** Whether on-device recognition is installed for `lang`; asked once. */
const localReady = new WeakMap<object, Map<string, Promise<boolean>>>();
function isLocalReady(Ctor: RecognitionCtor, lang: string): Promise<boolean> {
  const available = Ctor.available;
  if (!available) return Promise.resolve(false);
  const byLang = localReady.get(available) ?? new Map();
  localReady.set(available, byLang);
  let ready = byLang.get(lang);
  if (!ready) {
    ready = available.call(Ctor, { langs: [lang], processLocally: true }).then(
      (status) => status === "available",
      () => false,
    );
    byLang.set(lang, ready);
  }
  return ready;
}

/** Stop after this long with nothing new heard. */
export const SILENCE_MS = 8000;
/** How strongly the user's own words (categories) are preferred, 0–10. */
const PHRASE_BOOST = 3;

/**
 * One string per pause, in order; the last may still be in progress.
 * Android Chrome restates earlier results in continuous mode ("buy",
 * "buy milk"), so a result that starts with the previous one replaces it.
 */
export function readSegments(results: ArrayLike<RecognitionResult>): string[] {
  const segments: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const text = results[i][0].transcript.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const prev = segments[segments.length - 1];
    if (prev !== undefined && text.toLowerCase().startsWith(prev.toLowerCase()))
      segments[segments.length - 1] = text;
    else segments.push(text);
  }
  return segments;
}

const noopSubscribe = () => () => {};

export type SpeechError = "denied" | "no-speech" | "failed";

export function useSpeechCapture({
  onSegments,
  onError,
  phrases = [],
}: {
  /** Everything heard so far, one string per pause. */
  onSegments: (segments: string[]) => void;
  onError?: (error: SpeechError) => void;
  /** Words to listen out for, such as the user's category names. */
  phrases?: string[];
}) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => recognitionCtor() !== undefined && !isIosStandalone(),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const localRef = useRef(false);
  const phrasesOkRef = useRef(true);
  const callbacks = useRef({ onSegments, onError, phrases });
  useEffect(() => {
    callbacks.current = { onSegments, onError, phrases };
  }, [onSegments, onError, phrases]);

  // Ask ahead of time, so start() never waits on it inside the tap.
  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!supported || !Ctor) return;
    let live = true;
    void isLocalReady(Ctor, recognitionLang()).then((ok) => {
      if (live) localRef.current = ok;
    });
    return () => {
      live = false;
    };
  }, [supported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const open = () => {
      const recognition = new Ctor();
      recognition.lang = recognitionLang();
      recognition.continuous = true;
      recognition.interimResults = true;
      if (localRef.current) recognition.processLocally = true;

      const Phrase = (
        window as unknown as { SpeechRecognitionPhrase?: PhraseCtor }
      ).SpeechRecognitionPhrase;
      const words = callbacks.current.phrases;
      if (
        phrasesOkRef.current &&
        Phrase &&
        words.length &&
        "phrases" in recognition
      ) {
        try {
          recognition.phrases = words.map((w) => new Phrase(w, PHRASE_BOOST));
        } catch {
          phrasesOkRef.current = false;
        }
      }

      let idle: ReturnType<typeof setTimeout> | undefined;
      const armSilence = () => {
        clearTimeout(idle);
        idle = setTimeout(() => recognition.stop(), SILENCE_MS);
      };
      let retryWithoutPhrases = false;

      recognition.onresult = (e) => {
        armSilence();
        callbacks.current.onSegments(readSegments(e.results));
      };
      recognition.onerror = (e) => {
        if (e.error === "phrases-not-supported") {
          retryWithoutPhrases = true;
          return;
        }
        const error: SpeechError =
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "denied"
            : e.error === "no-speech"
              ? "no-speech"
              : "failed";
        // "aborted" is our own stop on unmount; not worth reporting.
        if (e.error !== "aborted") callbacks.current.onError?.(error);
      };
      recognition.onend = () => {
        clearTimeout(idle);
        recognitionRef.current = null;
        if (retryWithoutPhrases) {
          phrasesOkRef.current = false;
          open();
          return;
        }
        setListening(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        armSilence();
        setListening(true);
      } catch {
        clearTimeout(idle);
        recognitionRef.current = null;
        setListening(false);
        callbacks.current.onError?.("failed");
      }
    };
    open();
  }, []);

  // Never leave the microphone on after the capture closes.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop };
}
```

Design notes for the reviewer:
- **Android de-dupe:** the hook rebuilds from the whole `e.results` list on every event, never accumulating from `resultIndex`. A result that starts with the previous one replaces it.
- **On-device:** `available()` is asked once per `available` function and language, ahead of the tap, so `start()` stays synchronous inside the user gesture. iOS requires that. The cache is keyed by the `available` function so tests (and a browser upgrade) can't see a stale answer.
- **Hint phrases:** set only when both `SpeechRecognitionPhrase` and `recognition.phrases` exist. On `phrases-not-supported`, the hook reopens once without them and remembers that for the session.
- **No spoken announcements are added while listening.** A screen reader speaking "Listening" would be heard by the mic and transcribed. The button's label and `aria-pressed` already convey the state. (Spec deviation, deliberate.)

- [ ] **Step 4: Run the hook tests**

Run: `npx vitest run src/hooks/__tests__/useSpeechCapture.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run tsc to see the callers break**

Run: `npx tsc --noEmit`
Expected: errors in `CaptureModal.tsx` and `MindSweep.tsx`: `'onTranscript' does not exist`.

- [ ] **Step 6: Wire `CaptureModal.tsx`**

```diff
--- a/src/components/features/CaptureModal.tsx
+++ b/src/components/features/CaptureModal.tsx
@@ -44,6 +44,8 @@ import { ModalErrorBoundary } from "@/components/ui/ModalErrorBoundary";
 import { Sheet } from "@/components/ui/Sheet";
 import { useHaptics } from "@/hooks/useHaptics";
 import { useSpeechCapture } from "@/hooks/useSpeechCapture";
+import { joinSpokenSegments } from "@/lib/nlp/spoken";
+import { DEFAULT_DO_CATEGORIES } from "@/lib/constants";
 import { Button } from "@/components/ui/button";
 import { Icon as UiIcon } from "@/components/ui/Icon";
 
@@ -358,10 +360,14 @@ export function CaptureModal() {
     if (!value.trim()) setPreview(null);
   };
 
-  // Voice: spoken words are appended to whatever was already typed.
+  // Voice: spoken words are appended to whatever was already typed, with
+  // pauses turned into the sentence breaks the router splits on.
+  const categories = userSettings?.do_categories ?? DEFAULT_DO_CATEGORIES;
   const speechBaseRef = useRef("");
   const speech = useSpeechCapture({
-    onTranscript: (spoken) => {
+    phrases: categories,
+    onSegments: (segments) => {
+      const spoken = joinSpokenSegments(segments, categories);
       const base = speechBaseRef.current;
       handleInputChange(base ? `${base} ${spoken}` : spoken);
     },
```

- [ ] **Step 7: Wire `MindSweep.tsx`**

```diff
--- a/src/components/features/MindSweep.tsx
+++ b/src/components/features/MindSweep.tsx
@@ -10,6 +10,8 @@ import { createClient } from "@/lib/supabase";
 import { captureText } from "@/lib/quick-capture";
 import { destinationIdToLabel } from "@/lib/capture-router";
 import { useSpeechCapture } from "@/hooks/useSpeechCapture";
+import { joinSpokenSegments } from "@/lib/nlp/spoken";
+import { DEFAULT_DO_CATEGORIES } from "@/lib/constants";
 import { useHaptics } from "@/hooks/useHaptics";
 import { cn } from "@/lib/utils";
 
@@ -48,9 +50,13 @@ export function MindSweepPrompt({
   const [captured, setCaptured] = useState<Captured[]>([]);
   const speechBase = useRef("");
 
+  const categories = userSettings?.do_categories ?? DEFAULT_DO_CATEGORIES;
   const speech = useSpeechCapture({
-    onTranscript: (spoken) =>
-      setValue(speechBase.current ? `${speechBase.current} ${spoken}` : spoken),
+    phrases: categories,
+    onSegments: (segments) => {
+      const spoken = joinSpokenSegments(segments, categories);
+      setValue(speechBase.current ? `${speechBase.current} ${spoken}` : spoken);
+    },
     onError: (error) => {
       if (error === "denied") {
         toast.error("Microphone is blocked", {
```

- [ ] **Step 8: Add the CaptureModal integration test**

In `src/components/features/__tests__/CaptureModal.test.tsx`, inside the existing voice `describe`, add this after the test that ends with `expect(screen.getByRole("button", { name: "Speak" })).toBeInTheDocument();`:

```diff
--- a/src/components/features/__tests__/CaptureModal.test.tsx
+++ b/src/components/features/__tests__/CaptureModal.test.tsx
@@ -333,5 +333,24 @@ describe("CaptureModal — one-tap capture with a live preview", () => {
       expect(recognition.stop).toHaveBeenCalled();
       expect(screen.getByRole("button", { name: "Speak" })).toBeInTheDocument();
     });
+
+    it("turns a pause before a new item into a sentence break", () => {
+      (window as unknown as Record<string, unknown>).webkitSpeechRecognition =
+        FakeRecognition;
+      render(<CaptureModal />);
+      fireEvent.click(screen.getByRole("button", { name: "Speak" }));
+      act(() =>
+        instances[0].onresult?.({
+          resultIndex: 1,
+          results: [
+            { isFinal: true, 0: { transcript: "buy milk" } },
+            { isFinal: false, 0: { transcript: "call mom at five" } },
+          ],
+        }),
+      );
+      expect(screen.getByRole("textbox", { name: "Capture" })).toHaveValue(
+        "buy milk. Call mom at 5",
+      );
+    });
   });
 });
```

- [ ] **Step 9: Run the affected suites**

Run: `npx vitest run src/hooks src/components/features/__tests__/CaptureModal.test.tsx src/components/features/__tests__/RitualSweep.test.tsx`
Expected: PASS. The existing "adds what you say after what you typed" test still passes, because one final segment "eggs and bread" joins unchanged.

- [ ] **Step 10: Full gates, format only touched files, commit**

```bash
npx prettier --write src/hooks/useSpeechCapture.ts src/hooks/__tests__/useSpeechCapture.test.ts src/components/features/CaptureModal.tsx src/components/features/MindSweep.tsx src/components/features/__tests__/CaptureModal.test.tsx
npx tsc --noEmit
npm run lint
npm test
git status --short
```
Expected: tsc clean, `0 errors` from lint, `Tests 763 passed`. `git status` shows only the five files above as modified (plus pre-existing untracked files). If anything else appears, `git restore` it.

```bash
git add src/hooks/useSpeechCapture.ts src/hooks/__tests__/useSpeechCapture.test.ts src/components/features/CaptureModal.tsx src/components/features/MindSweep.tsx src/components/features/__tests__/CaptureModal.test.tsx
git commit -m "feat(voice): split spoken items at pauses; on-device when installed; fix Android repeats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Real-device verification, real-speech accuracy, docs, PR

No code is written in this task. It proves the feature on real recognisers and records the evidence.

**Files:**
- Modify: `CLAUDE.md` (verified-state table)

- [ ] **Step 1: Build and check bundle budgets**

```bash
npm run build
```
Expected: build succeeds. Then start `npm start` in a separate terminal and run:
```bash
npm run check:budgets
```
Expected: all budgets pass. `spoken.ts` is about 4 KB of source in the capture chunk, and there are no new dependencies.

- [ ] **Step 2: Desktop check in the browser pane**

Start the dev server (`preview_start` with the project's dev config) and sign in with the seeded test account. Open Quick Capture and confirm the mic button shows. Screenshot it. Real speech can't be driven from automation, so the speech check itself is Step 3.

- [ ] **Step 3: Real-speech accuracy check (the user, on their own devices)**

Speak 30 real brain dumps of your own, spread across desktop Chrome, Android Chrome and iPhone Safari (in a tab). Include at least 10 with several items in one breath. For each, record whether the items, titles and dates in the preview are fully correct before saving. Keep the results as a table in the PR description:

| # | Device | Said | Result | Correct? |
|---|---|---|---|---|

Pass bar: **at least 27 / 30 (90%) fully correct.** Every miss becomes a new case in `spoken-captures.ts` (Task 2's file), with a fix in `spoken.ts` if the rule is general. If the rate stays below 90% after one round of fixes, that is the evidence for the AI-fallback spec (approach B). Don't add it in this branch.

Also confirm on each device:
- **Android:** no repeated words while speaking.
- **iPhone, installed to the home screen:** the mic button is hidden, and the keyboard dictation key works in the field.
- **Desktop Chrome:** 8 s of silence stops listening.

- [ ] **Step 4: Update `CLAUDE.md` verified state**

In the "Verified state" table, change the `npm test` row to the new count from `npm test` (763 passed / 64 files at plan time). Change the table date to the day of the run.

- [ ] **Step 5: Commit, push, open the PR**

```bash
git add CLAUDE.md
git commit -m "docs: verified state after voice capture work

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/voice-understanding
gh pr create --base main --title "Voice capture: split spoken items, read spoken times, on-device when installed" --body-file <pr-body.md>
```
The PR body includes:
- the spec link;
- what changed;
- the Step 3 accuracy table;
- the gate results;
- `🤖 Generated with [Claude Code](https://claude.com/claude-code)` at the end.
