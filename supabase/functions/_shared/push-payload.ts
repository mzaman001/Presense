/**
 * What a reminder says and where it leads. Kept apart from index.ts so it
 * can be type-checked and tested without a server.
 *
 * Copy rules (docs/research/Task reminder notifications.md): name the task and
 * its smallest first step, forward-looking and neutral. Never count
 * overdue items or mention misses.
 */

export interface ClaimedReminder {
  kind: "task" | "ritual_morning" | "ritual_evening";
  user_id: string;
  item_id: string | null;
  title: string | null;
  first_step: string | null;
}

export interface ReminderMessage {
  title: string;
  body: string;
  /** Same-origin path the notification opens. */
  path: string;
  /** One notification per task / ritual: a newer one replaces it. */
  tag: string;
}

const MAX_TITLE = 120;

function clip(text: string, max: number) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function reminderMessage(r: ClaimedReminder): ReminderMessage {
  if (r.kind === "ritual_morning") {
    return {
      title: "Plan your day",
      body: "A few minutes to pick what fits today.",
      path: "/",
      tag: "presense-ritual",
    };
  }
  if (r.kind === "ritual_evening") {
    return {
      title: "Wind down",
      body: "Close the day and set up tomorrow.",
      path: "/",
      tag: "presense-ritual",
    };
  }
  const title = clip(r.title || "Your task", MAX_TITLE);
  const step = r.first_step?.trim();
  return {
    title,
    body: step
      ? `Ready when you are: ${clip(step, MAX_TITLE)}`
      : "Ready when you are.",
    path: `/do?remind=${encodeURIComponent(r.item_id ?? "")}`,
    tag: `task-${r.item_id}`,
  };
}

/**
 * The push payload. It's Safari's declarative format (`web_push: 8030`),
 * which Safari can show even if the service worker fails; other browsers
 * hand the same JSON to the worker's push handler, which shows it.
 */
export function pushPayload(message: ReminderMessage, origin: string | null) {
  const base = origin && /^https?:\/\//.test(origin) ? origin : null;
  return {
    web_push: 8030,
    notification: {
      title: message.title,
      body: message.body,
      tag: message.tag,
      // Declarative push needs an absolute URL; the worker accepts a path.
      navigate: base ? new URL(message.path, base).href : message.path,
      lang: "en",
      dir: "auto",
    },
  };
}

/** Topic header: ≤32 URL-safe chars, so a newer undelivered push replaces. */
export function pushTopic(message: ReminderMessage) {
  // A task's UUID without dashes is exactly 32 hex chars.
  return message.tag
    .replace(/^task-/, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 32);
}

/** Settings → "Send a test": proof this device can get reminders. */
export function testMessage(): ReminderMessage {
  return {
    title: "Reminders are on",
    body: "This is how a reminder from Presense will look.",
    path: "/",
    tag: "presense-test",
  };
}
