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
