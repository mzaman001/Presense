"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Clock3,
  CloudSun,
  Frown,
  HelpCircle,
  Hourglass,
  Layers,
  Meh,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { createClient, safeMutate } from "@/lib/supabase";
import {
  readSubtasks,
  removeTaskFromCaches,
  updateTaskInCaches,
  type TaskRecord,
} from "@/lib/task-cache";
import { freshStartPatch, keepAsIsPatch, notNowPatch } from "@/lib/stuck-tasks";
import { moveItemToTrashPatch, restoreItemPatch } from "@/lib/item-lifecycle";
import { cn } from "@/lib/utils";

type Reason =
  "too_big" | "unclear" | "boring" | "dread" | "dont_want" | "waiting";

/**
 * The reasons map onto the task-aversiveness dimensions that best predict
 * putting a task off (Blunt & Pychyl 2000), including the two a simple
 * "too big / unclear / boring" list misses: resentment and lack of meaning
 * ("I don't really want to"), which call for dropping or reframing the
 * task rather than a timer.
 */
const REASONS: { id: Reason; label: string; hint: string; icon: LucideIcon }[] =
  [
    {
      id: "too_big",
      label: "It's too big",
      hint: "Break it into small steps",
      icon: Layers,
    },
    {
      id: "unclear",
      label: "It's unclear",
      hint: "Pin down what done looks like",
      icon: HelpCircle,
    },
    {
      id: "boring",
      label: "It's boring",
      hint: "A short timer and it's over",
      icon: Meh,
    },
    {
      id: "dread",
      label: "I'm dreading it",
      hint: "Start with a rough first go",
      icon: Frown,
    },
    {
      id: "dont_want",
      label: "I don't really want to",
      hint: "Drop it, park it, or remember why",
      icon: CloudSun,
    },
    {
      id: "waiting",
      label: "I'm waiting on something",
      hint: "Park it until you can act",
      icon: Hourglass,
    },
  ];

const inputClass = "input w-full !text-[length:var(--text-body)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[length:var(--text-ui)] font-medium text-[var(--text-2)]">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * "What's in the way?" for a task that keeps getting put off. It asks
 * rather than nags: one question, a small concrete fix for the answer, and
 * "Not now" / "Keep as is" always there with equal weight. Nothing here
 * counts or mentions how often the task was deferred.
 */
export function StuckTaskHelp() {
  // Separate selectors: one returning a fresh object each time would
  // re-render forever.
  const task = useAppStore((s) => s.stuckHelpTask);
  const setStuckHelpTask = useAppStore((s) => s.setStuckHelpTask);
  const setActiveTimer = useAppStore((s) => s.setActiveTimer);
  if (!task) return null;
  const close = () => setStuckHelpTask(null);
  return (
    <StuckTaskHelpSheet
      key={task.id}
      task={task}
      onClose={close}
      onStartTimer={(minutes, firstStep) =>
        setActiveTimer({
          taskId: task.id,
          taskTitle: task.title,
          firstStep: firstStep ?? task.first_step,
          minutes,
        })
      }
    />
  );
}

function StuckTaskHelpSheet({
  task,
  onClose,
  onStartTimer,
}: {
  task: TaskRecord;
  onClose: () => void;
  onStartTimer: (minutes: number, firstStep?: string | null) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const markMutation = useAppStore((s) => s.markMutation);
  const [reason, setReason] = useState<Reason | null>(null);
  const [saving, setSaving] = useState(false);

  const [steps, setSteps] = useState(["", "", ""]);
  const [doneLooksLike, setDoneLooksLike] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [roughStart, setRoughStart] = useState(
    "Write a rough, ugly first version",
  );
  const [why, setWhy] = useState("");
  const [waitingOn, setWaitingOn] = useState("");
  const [followUp, setFollowUp] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toLocaleDateString("en-CA");
  });

  /** Saves a change to the task, updating every cached list first. */
  const save = async (
    patch: Partial<TaskRecord>,
    message?: string,
  ): Promise<boolean> => {
    setSaving(true);
    const rollback = updateTaskInCaches(queryClient, task.id, patch);
    const { success } = await safeMutate(
      () => supabase.from("items").update(patch).eq("id", task.id),
      "Couldn't save that",
    );
    setSaving(false);
    if (!success) {
      rollback();
      return false;
    }
    markMutation("items");
    if (message) toast.success(message);
    return true;
  };

  const fix = async (patch: Partial<TaskRecord>, message: string) => {
    if (await save({ ...patch, ...freshStartPatch() }, message)) onClose();
  };

  const prependNote = (line: string) =>
    task.notes ? `${line}\n\n${task.notes}` : line;

  const letGo = async () => {
    setSaving(true);
    const rollback = removeTaskFromCaches(queryClient, task.id);
    const { success } = await safeMutate(
      () =>
        supabase.from("items").update(moveItemToTrashPatch()).eq("id", task.id),
      "Couldn't drop the task",
    );
    setSaving(false);
    if (!success) return rollback();
    markMutation("items");
    onClose();
    toast.success("Let go", {
      description: "It's in Trash if you change your mind.",
      action: {
        label: "Undo",
        onClick: async () => {
          const { success: restored } = await safeMutate(
            () =>
              supabase
                .from("items")
                .update(restoreItemPatch("active"))
                .eq("id", task.id),
            "Failed to undo",
          );
          if (restored) {
            markMutation("items");
            rollback();
          }
        },
      },
    });
  };

  const body = (() => {
    switch (reason) {
      case null:
        return (
          <div className="space-y-4">
            <p className="text-[length:var(--text-body)] text-[var(--text-3)]">
              This one keeps getting moved. That usually means something about
              it is in the way. Pick what fits.
            </p>
            <div className="grid gap-2">
              {REASONS.map(({ id, label, hint, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setReason(id)}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[var(--accent-text)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[length:var(--text-body)] font-medium text-[var(--text-1)]">
                      {label}
                    </span>
                    <span className="block text-[length:var(--text-ui)] text-[var(--text-3)]">
                      {hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case "too_big": {
        const filled = steps.map((s) => s.trim()).filter(Boolean);
        return (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!filled.length) return;
              void fix(
                {
                  subtasks: [
                    ...readSubtasks(task.subtasks),
                    ...filled.map((text) => ({ text, completed: false })),
                    // Plain { text, completed } objects: valid jsonb, but the
                    // Subtask interface has no index signature for Json.
                  ] as unknown as TaskRecord["subtasks"],
                  first_step: filled[0],
                },
                `Broken down. First step: ${filled[0]}`,
              );
            }}
          >
            <p className="text-[length:var(--text-body)] text-[var(--text-3)]">
              Just the next one to three steps, each small enough to start
              without thinking. Only the first one has to be clear.
            </p>
            {steps.map((value, i) => (
              <Field key={i} label={`Step ${i + 1}${i ? " (optional)" : ""}`}>
                <input
                  className={inputClass}
                  value={value}
                  autoFocus={i === 0}
                  maxLength={200}
                  onChange={(e) =>
                    setSteps((prev) =>
                      prev.map((s, j) => (j === i ? e.target.value : s)),
                    )
                  }
                />
              </Field>
            ))}
            <Button
              type="submit"
              disabled={!filled.length || saving}
              className="w-full"
            >
              Save steps
            </Button>
          </form>
        );
      }

      case "unclear":
        return (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!doneLooksLike.trim()) return;
              void fix(
                {
                  notes: prependNote(`Done when: ${doneLooksLike.trim()}`),
                  ...(firstStep.trim() ? { first_step: firstStep.trim() } : {}),
                },
                "Clearer now",
              );
            }}
          >
            <Field label="What does done look like?">
              <input
                className={inputClass}
                autoFocus
                maxLength={300}
                value={doneLooksLike}
                onChange={(e) => setDoneLooksLike(e.target.value)}
                placeholder="e.g. the form is sent and I have the receipt"
              />
            </Field>
            <Field label="What would you need to find out first? (optional)">
              <input
                className={inputClass}
                maxLength={200}
                value={firstStep}
                onChange={(e) => setFirstStep(e.target.value)}
                placeholder="e.g. Find out which form they need"
              />
            </Field>
            <Button
              type="submit"
              disabled={!doneLooksLike.trim() || saving}
              className="w-full"
            >
              Save
            </Button>
          </form>
        );

      case "boring":
        return (
          <div className="space-y-3">
            <p className="text-[length:var(--text-body)] text-[var(--text-3)]">
              Boring tasks shrink when they have an end. Give it five minutes,
              then stop or keep going. Music or a favourite drink alongside can
              help.
            </p>
            <Button
              className="w-full"
              disabled={saving}
              onClick={async () => {
                if (await save(freshStartPatch())) {
                  onClose();
                  onStartTimer(5);
                }
              }}
            >
              <Clock3 aria-hidden="true" className="size-4" /> Start 5 minutes
            </Button>
          </div>
        );

      case "dread":
        return (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const step = roughStart.trim();
              if (
                await save({
                  ...freshStartPatch(),
                  ...(step ? { first_step: step } : {}),
                })
              ) {
                onClose();
                onStartTimer(2, step || null);
              }
            }}
          >
            <p className="text-[length:var(--text-body)] text-[var(--text-3)]">
              The dread is usually worse than the task. Aim for a bad version in
              two minutes. Nobody sees it, and it&apos;s easier to fix something
              than to start from nothing.
            </p>
            <Field label="Your first step">
              <input
                className={inputClass}
                maxLength={200}
                value={roughStart}
                onChange={(e) => setRoughStart(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={saving} className="w-full">
              <Clock3 aria-hidden="true" className="size-4" /> Start 2 minutes
            </Button>
          </form>
        );

      case "dont_want":
        return (
          <div className="space-y-4">
            <p className="text-[length:var(--text-body)] text-[var(--text-3)]">
              Not everything on the list has to happen. Deciding is progress
              too.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => void letGo()}
              >
                <Trash2 aria-hidden="true" className="size-4" /> Let it go
              </Button>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() =>
                  void fix(
                    { deadline: null, snoozed_until: null },
                    "Moved to Someday",
                  )
                }
              >
                <CloudSun aria-hidden="true" className="size-4" /> Someday
              </Button>
            </div>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!why.trim()) return;
                void fix(
                  { notes: prependNote(`Why it matters: ${why.trim()}`) },
                  "Noted why it matters",
                );
              }}
            >
              <Field label="Or keep it, and note why it matters">
                <input
                  className={inputClass}
                  maxLength={300}
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="e.g. so the landlord returns the deposit"
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                disabled={!why.trim() || saving}
                className="w-full"
              >
                Keep it
              </Button>
            </form>
          </div>
        );

      case "waiting":
        return (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const [y, mo, d] = followUp.split("-").map(Number);
              const at = new Date(y, mo - 1, d, 9, 0, 0);
              void fix(
                {
                  snoozed_until: at.toISOString(),
                  ...(waitingOn.trim()
                    ? { notes: prependNote(`Waiting on: ${waitingOn.trim()}`) }
                    : {}),
                },
                `Parked until ${at.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`,
              );
            }}
          >
            <Field label="What are you waiting on? (optional)">
              <input
                className={inputClass}
                autoFocus
                maxLength={200}
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                placeholder="e.g. Sam's reply about the quote"
              />
            </Field>
            <Field label="Bring it back on">
              <input
                type="date"
                className={inputClass}
                value={followUp}
                min={new Date().toLocaleDateString("en-CA")}
                onChange={(e) => e.target.value && setFollowUp(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={saving} className="w-full">
              Park it
            </Button>
          </form>
        );
    }
  })();

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title="What's in the way?"
      footer={
        <div className="flex items-center gap-2">
          {reason ? (
            <Button
              variant="ghost"
              onClick={() => setReason(null)}
              className="-ml-2"
            >
              <ChevronLeft aria-hidden="true" className="size-4" /> Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              disabled={saving}
              onClick={async () => {
                if (await save(keepAsIsPatch())) onClose();
              }}
              className="-ml-2"
            >
              Keep as is
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={saving}
            onClick={async () => {
              if (await save(notNowPatch(task))) onClose();
            }}
            className="ml-auto"
          >
            Not now
          </Button>
        </div>
      }
    >
      <p
        className={cn(
          "font-heading mb-4 line-clamp-2 text-[length:var(--text-title-md)] text-[var(--text-1)]",
        )}
      >
        {task.title}
      </p>
      {body}
    </Sheet>
  );
}
