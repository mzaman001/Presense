/**
 * The times offered for "Remind me" and for "Later" on a reminder. They
 * follow the day's routine rather than fixed offsets: a year-long study of
 * snoozed reminders found people push them to later the same day or the
 * next morning, rarely further (Weber et al. 2018).
 */

export type ReminderPresetId = "hour" | "evening" | "morning";

export interface ReminderPreset {
  id: ReminderPresetId;
  label: string;
  at: Date;
}

const FIVE_MIN = 5 * 60_000;

/** "18:00" / "18:00:00" → [18, 0]; anything else → fallback. */
function parseClock(
  value: string | null | undefined,
  fallback: [number, number],
) {
  const m = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? ([h, min] as [number, number]) : fallback;
}

export function reminderPresets(
  now: Date,
  settings: { nudge_time?: string | null; shutdown_time?: string | null } = {},
): ReminderPreset[] {
  const presets: ReminderPreset[] = [];

  // An hour from now, on a round five minutes.
  const hour = new Date(
    Math.ceil((now.getTime() + 60 * 60_000) / FIVE_MIN) * FIVE_MIN,
  );
  presets.push({ id: "hour", label: "In an hour", at: hour });

  // This evening at the shutdown time, while that's still a while away.
  const [eh, em] = parseClock(settings.shutdown_time, [18, 0]);
  const evening = new Date(now);
  evening.setHours(eh, em, 0, 0);
  if (evening.getTime() - now.getTime() >= 90 * 60_000) {
    presets.push({ id: "evening", label: "This evening", at: evening });
  }

  // Tomorrow at the planning time.
  const [mh, mm] = parseClock(settings.nudge_time, [10, 0]);
  const morning = new Date(now);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(mh, mm, 0, 0);
  presets.push({ id: "morning", label: "Tomorrow morning", at: morning });

  return presets;
}

/** "3:00 PM", "Tomorrow 10:00 AM", "Mon 12 Oct, 9:00 AM". */
export function formatReminderTime(at: Date, now: Date = new Date()): string {
  const time = at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(now)) / 86_400_000);
  if (days === 0) return time;
  if (days === 1) return `Tomorrow ${time}`;
  const date = at.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${date}, ${time}`;
}

/** A pending reminder worth showing on a task: set, in the future, unsent. */
export function upcomingReminder(
  task: { remind_at?: string | null; reminder_sent_at?: string | null },
  now: number = Date.now(),
): Date | null {
  if (!task.remind_at || task.reminder_sent_at) return null;
  const at = new Date(task.remind_at);
  return at.getTime() > now ? at : null;
}
