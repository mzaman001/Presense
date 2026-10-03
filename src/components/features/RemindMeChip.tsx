"use client";

import { format } from "date-fns";
import { Bell } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { getReminderAvailability } from "@/lib/reminders";
import { formatReminderTime, reminderPresets } from "@/lib/reminder-times";
import { useAppStore, type UserSettings } from "@/store/useAppStore";

const INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm";

/**
 * "Remind me" on a task: opt-in, at a time the user picks. Nothing here
 * looks at the due date; a reminder is about when to start.
 *
 * `value` is a datetime-local string, or "" for no reminder.
 */
export function RemindMeChip({
  value,
  onChange,
  settings,
}: {
  value: string;
  onChange: (next: string) => void;
  settings: UserSettings | undefined;
}) {
  const setSettingsModalOpen = useAppStore((s) => s.setSettingsModalOpen);
  const now = new Date();
  const presets = reminderPresets(now, settings);
  const chosen = value ? new Date(value) : null;
  // Whether a reminder can reach this device at all, so setting one is
  // never a silent promise.
  const reachable =
    getReminderAvailability() === "granted" &&
    settings?.notifications_enabled !== false;

  return (
    <Popover
      trigger={
        <button type="button" aria-pressed={Boolean(chosen)} className="chip">
          <Bell aria-hidden="true" className="size-4" />
          {chosen ? formatReminderTime(chosen, now) : "Remind me"}
        </button>
      }
      content={
        <div className="w-[min(320px,calc(100vw-32px))] space-y-3 p-3">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip chip-sm"
                aria-pressed={value === format(p.at, INPUT_FORMAT)}
                onClick={() => onChange(format(p.at, INPUT_FORMAT))}
              >
                {p.label}
              </button>
            ))}
            {chosen && (
              <button
                type="button"
                className="chip chip-sm"
                onClick={() => onChange("")}
              >
                No reminder
              </button>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="remind-at">
              Remind me at
            </label>
            <input
              id="remind-at"
              type="datetime-local"
              value={value}
              min={format(now, INPUT_FORMAT)}
              onChange={(e) => onChange(e.target.value)}
              className="input !px-2.5 !py-2 !text-[length:var(--text-ui)]"
            />
          </div>
          {!reachable && (
            <p className="text-[length:var(--text-meta)] text-[var(--text-3)]">
              Reminders are off on this device.{" "}
              <button
                type="button"
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                onClick={() => setSettingsModalOpen(true, "notifications")}
              >
                Turn them on
              </button>
            </p>
          )}
        </div>
      }
    />
  );
}
