"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import { formatReminderTime, reminderPresets } from "@/lib/reminder-times";
import { updateTaskInCaches, type TaskRecord } from "@/lib/task-cache";
import { useAppStore } from "@/store/useAppStore";
import { friendlyError } from "@/lib/friendly-error";

/**
 * Where a tapped task reminder lands: the task and its first step, a way to
 * start, and "Later" at routine times. The notification itself has no
 * buttons on iPhone, so this screen is where the choice happens.
 *
 * "Later" moves the reminder and snoozes the task to the same time. The
 * snooze is what the items_track_deferral trigger counts, so a task put off
 * again and again gets the existing "What's in the way?" help on Do, never
 * a notification about it.
 */
export function ReminderSheet({
  task,
  onClose,
}: {
  task: TaskRecord | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const setActiveTimer = useAppStore((s) => s.setActiveTimer);
  const markMutation = useAppStore((s) => s.markMutation);
  const settings = useAppStore((s) => s.userSettings);

  if (!task) return null;
  const presets = reminderPresets(new Date(), settings);

  const start = () => {
    setActiveTimer({
      taskId: task.id,
      taskTitle: task.title,
      firstStep: task.first_step,
    });
    onClose();
  };

  const later = async (at: Date) => {
    const iso = at.toISOString();
    const patch = {
      remind_at: iso,
      snoozed_until: iso,
      reminder_sent_at: null,
    };
    const rollback = updateTaskInCaches(queryClient, task.id, patch);
    onClose();
    markMutation("items");
    const { error } = await supabase
      .from("items")
      .update({ remind_at: iso, snoozed_until: iso })
      .eq("id", task.id);
    if (error) {
      rollback();
      toast.error("Couldn't move the reminder", {
        description: friendlyError(error),
      });
      return;
    }
    toast.success(`Reminder moved to ${formatReminderTime(at)}`);
  };

  return (
    <Sheet isOpen onClose={onClose} title="Reminder">
      <div className="space-y-5">
        <div>
          <p className="text-[length:var(--text-title-md)] font-medium text-[var(--text-1)]">
            {task.title}
          </p>
          {task.first_step && (
            <p className="mt-1 text-[length:var(--text-body)] text-[var(--text-2)]">
              First step: {task.first_step}
            </p>
          )}
        </div>

        <Button className="h-11 w-full" onClick={start}>
          <Play aria-hidden="true" className="size-4" />
          Start
        </Button>

        <div>
          <p className="field-label">Later</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                onClick={() => void later(p.at)}
              >
                {p.label}
                <span className="text-[var(--text-3)]">
                  {formatReminderTime(p.at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
