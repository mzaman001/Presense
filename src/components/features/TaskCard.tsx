"use client";
import React, { useMemo, useState } from "react";
import { m, useMotionValue, useTransform, animate } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Flag,
  ListChecks,
  Play,
  Repeat,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatRRule } from "@/lib/utils";
import { formatMinutes } from "@/lib/format-minutes";
import { resolveCategoryColor } from "@/lib/constants";
import { toast } from "sonner";
import {
  addTaskToCaches,
  removeTaskFromCaches,
  updateTaskInCaches,
  readSubtasks,
  type TaskRecord,
} from "@/lib/task-cache";
import { useQueryClient } from "@tanstack/react-query";
import { useHaptics } from "@/hooks/useHaptics";
import { moveItemToTrashPatch, restoreItemPatch } from "@/lib/item-lifecycle";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { CheckTick } from "@/components/ui/CheckTick";
import { isStuck } from "@/lib/stuck-tasks";

function formatDeadline(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow =
    new Date(now.getTime() + 86400000).toDateString() === date.toDateString();
  if (date < now && !isToday) return "Overdue";
  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SWIPE_DELETE_THRESHOLD = -80;
const SWIPE_COMPLETE_THRESHOLD = 80;

export const TaskCard = React.memo(
  ({
    task,
    completing,
    completeTask,
    openEditPanel,
    fetchTasks,
  }: {
    /* @todo: Untyped usage justified per TOOL-01 */

    task: TaskRecord;
    completing: string | null;
    completeTask: (e: React.MouseEvent, id: string) => void;
    /* @todo: Untyped usage justified per TOOL-01 */

    openEditPanel: (task: TaskRecord) => void;
    fetchTasks: () => void;
  }) => {
    const userSettings = useAppStore((s) => s.userSettings);
    const setActiveTimer = useAppStore((s) => s.setActiveTimer);
    const setStuckHelpTask = useAppStore((s) => s.setStuckHelpTask);
    const markMutation = useAppStore((s) => s.markMutation);
    const supabase = useMemo(() => createClient(), []);
    const [deleted, setDeleted] = useState(false);
    const queryClient = useQueryClient();
    const haptics = useHaptics();

    const dragX = useMotionValue(0);
    const deleteOpacity = useTransform(
      dragX,
      [0, SWIPE_DELETE_THRESHOLD],
      [0, 1],
    );
    const deleteScale = useTransform(
      dragX,
      [0, SWIPE_DELETE_THRESHOLD],
      [0.7, 1],
    );
    const completeOpacity = useTransform(
      dragX,
      [0, SWIPE_COMPLETE_THRESHOLD],
      [0, 1],
    );
    const completeScale = useTransform(
      dragX,
      [0, SWIPE_COMPLETE_THRESHOLD],
      [0.7, 1],
    );
    const cardX = dragX;

    const label = formatDeadline(task.deadline);
    const isOverdue = label === "Overdue";
    const subtasks = readSubtasks(task.subtasks);
    const completedSubtasks = subtasks.filter((st) => st.completed).length;
    const priority = Number(task.priority) || 4;
    const categoryColor = resolveCategoryColor(
      task.category,
      userSettings?.do_category_colors,
      "var(--text-muted)",
    );

    const priorityColor =
      priority === 1
        ? "var(--priority-urgent)"
        : priority === 2
          ? "var(--priority-high)"
          : priority === 3
            ? "var(--priority-medium)"
            : "var(--border-strong)";
    const priorityLabel =
      priority === 1
        ? "Urgent"
        : priority === 2
          ? "High"
          : priority === 3
            ? "Medium"
            : "Low";
    const isCompleting = completing === task.id;

    /* BUG-44 — swipe and hover trash button share one soft-delete path:
       optimistic cache removal → moveItemToTrashPatch() → toast with Undo.
       DS-11: soft delete never shows a confirmation dialog. */
    const handleTaskDelete = async () => {
      const rollback = removeTaskFromCaches(queryClient, task.id);

      try {
        const { error } = await supabase
          .from("items")
          .update(moveItemToTrashPatch())
          .eq("id", task.id);
        if (error) throw error;

        markMutation();
        fetchTasks();

        toast.success("Task moved to trash", {
          action: {
            label: "Undo",
            onClick: async () => {
              const undoRollback = addTaskToCaches(queryClient, task);
              try {
                const { error: undoError } = await supabase
                  .from("items")
                  .update(restoreItemPatch("active"))
                  .eq("id", task.id);
                if (undoError) throw undoError;
                fetchTasks();
              } catch {
                undoRollback();
                toast.error("Failed to restore task");
              }
            },
          },
        });
      } catch {
        rollback();

        animate(dragX, 0, { duration: 0.3 });
        setDeleted(false);
        toast.error("Failed to move task to trash");
      }
    };

    /* @todo: Untyped usage justified per TOOL-01 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleDragEnd = async (_: any, info: any) => {
      if (info.offset.x < SWIPE_DELETE_THRESHOLD) {
        haptics.heavy();

        // Animate out card locally
        animate(dragX, -300, { duration: 0.25 });
        setDeleted(true);

        await handleTaskDelete();
      } else if (info.offset.x > SWIPE_COMPLETE_THRESHOLD && !isCompleting) {
        /* BUG-44 follow-up: the swipe-to-complete reveal layer above was
           purely cosmetic — releasing past SWIPE_COMPLETE_THRESHOLD never
           called completeTask, so the gesture did nothing and no haptic
           ever fired for it. Route it through the same completeTask used
           by the checkbox tap so both paths share one behavior (and its
           haptics.success() call, do/page.tsx). */
        animate(dragX, 300, { duration: 0.25 });
        try {
          await completeTask(
            { stopPropagation: () => {} } as React.MouseEvent,
            task.id,
          );
        } catch {
          animate(dragX, 0, { duration: 0.3 });
        }
      } else {
        animate(dragX, 0, { type: "spring", stiffness: 400, damping: 40 });
      }
    };

    /* BUG-44 — hover trash button; stops propagation so the card's edit
       panel doesn't open on delete click. */
    const handleHoverDeleteClick = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (deleted) return;
      haptics.heavy();
      animate(dragX, -300, { duration: 0.25 });
      setDeleted(true);
      await handleTaskDelete();
    };

    const snoozedUntil =
      task.snoozed_until && new Date(task.snoozed_until) > new Date()
        ? new Date(task.snoozed_until)
        : null;
    const timeSpent = formatMinutes(task.time_spent_minutes);
    const allSubtasksDone =
      subtasks.length > 0 && completedSubtasks === subtasks.length;
    const shortTitle = String(task.title ?? "task").slice(0, 40);

    const cancelSnooze = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const rollback = updateTaskInCaches(queryClient, task.id, {
        snoozed_until: null,
      });
      try {
        markMutation();
        const { error } = await supabase
          .from("items")
          .update({ snoozed_until: null })
          .eq("id", task.id);
        if (error) throw error;
        fetchTasks();
      } catch {
        rollback();
        toast.error("Failed to cancel snooze");
      }
    };

    return (
      <m.div
        layout
        layoutId={task.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{
          opacity: 0,
          scale: 0.97,
          x: -16,
          transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
        }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="task-card-wrapper group relative rounded-[var(--radius-lg)]"
      >
        {/* Swipe-to-complete reveal layer */}
        <m.div
          className="absolute inset-0 flex items-center justify-start overflow-hidden rounded-[var(--radius-lg)] bg-[var(--status-done-dim)] pl-5"
          style={{ opacity: completeOpacity }}
        >
          <m.div style={{ scale: completeScale }}>
            <UiIcon
              className="h-5 w-5 text-[var(--status-done)]"
              icon={Check}
            />
          </m.div>
        </m.div>

        {/* Swipe-to-delete reveal layer */}
        <m.div
          className="absolute inset-0 flex items-center justify-end overflow-hidden rounded-[var(--radius-lg)] bg-[var(--status-danger-dim)] pr-5"
          style={{ opacity: deleteOpacity }}
        >
          <m.div style={{ scale: deleteScale }}>
            <UiIcon
              className="h-5 w-5 text-[var(--status-danger)]"
              icon={Trash2}
            />
          </m.div>
        </m.div>

        {/* Draggable card */}
        <m.div
          drag="x"
          dragConstraints={{ left: -120, right: 120 }}
          dragElastic={{ left: 0.15, right: 0.15 }}
          onDragEnd={handleDragEnd}
          style={{ x: cardX }}
          transition={{ duration: 0.25 }}
          className="relative"
        >
          {/* One row, Things/Todoist style: a round checkbox whose ring
              carries the priority, the title, an optional first step, and a
              single quiet line of details. Nothing renders for an empty
              field, so a bare task is one calm line. */}
          <GlassCard
            onClick={() => openEditPanel(task)}
            className={cn(
              "task-card cursor-pointer !rounded-[var(--radius-lg)] !py-3 !pr-2 !pl-3.5",
              isCompleting && "task-card-done",
            )}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={(e) => completeTask(e, task.id)}
                aria-label={`Complete ${shortTitle}`}
                aria-pressed={isCompleting}
                title={`${priorityLabel} priority`}
                className={cn("task-check", isCompleting && "checked")}
                style={
                  priority < 4
                    ? ({ "--check-ring": priorityColor } as React.CSSProperties)
                    : undefined
                }
              >
                {isCompleting && (
                  <CheckTick className="h-3 w-3 text-[var(--text-on-accent)]" />
                )}
              </button>

              <div
                className={cn(
                  "min-w-0 flex-1 py-px",
                  isCompleting && "is-done",
                )}
              >
                <p
                  // Element Timing: reports when task titles first paint, the
                  // metric the Do page's load work is measured against.
                  // (not in React's attribute types, hence the spread)
                  {...{ elementtiming: "task-title" }}
                  className="text-body-lg line-clamp-2 leading-snug font-medium text-[var(--text-1)]"
                >
                  <span className="task-title-strike">{task.title}</span>
                </p>

                {task.first_step && (
                  <p className="text-ui mt-0.5 flex min-w-0 items-center gap-1.5 text-[var(--text-3)]">
                    <UiIcon
                      size={13}
                      className="shrink-0 text-[var(--accent-text)]"
                      icon={ArrowRight}
                    />
                    <span className="truncate">{task.first_step}</span>
                  </p>
                )}

                <div className="task-meta mt-1.5">
                  {priority < 3 ? (
                    <span style={{ color: priorityColor }}>
                      <UiIcon size={12} icon={Flag} />
                      {priorityLabel}
                    </span>
                  ) : (
                    <span className="sr-only">{priorityLabel} priority</span>
                  )}
                  {label && (
                    <span
                      // Past dates read neutrally: a red "Overdue" on every
                      // late task feeds the guilt that drives avoidance.
                      style={{
                        color:
                          label === "Today" ? "var(--status-today)" : undefined,
                      }}
                    >
                      <UiIcon size={12} icon={CalendarDays} />
                      {isOverdue && task.deadline
                        ? `From ${new Date(task.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : label}
                    </span>
                  )}
                  {task.recurrence && (
                    <span>
                      <UiIcon size={12} icon={Repeat} />
                      {formatRRule(task.recurrence)}
                    </span>
                  )}
                  {subtasks.length > 0 && (
                    <span
                      style={{
                        color: allSubtasksDone
                          ? "var(--status-done)"
                          : undefined,
                      }}
                    >
                      <UiIcon size={12} icon={ListChecks} />
                      {completedSubtasks}/{subtasks.length}
                    </span>
                  )}
                  {timeSpent && (
                    <span title="Time spent on this task">
                      <UiIcon size={12} icon={Timer} />
                      {timeSpent}
                    </span>
                  )}
                  {snoozedUntil && (
                    <span>
                      <UiIcon size={12} icon={Clock} />
                      Snoozed until{" "}
                      {snoozedUntil.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      <button
                        type="button"
                        onClick={cancelSnooze}
                        aria-label="Cancel snooze"
                        className="-my-1 ml-0.5 rounded p-0.5 hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                      >
                        <UiIcon size={12} icon={X} />
                      </button>
                    </span>
                  )}
                  <span className="task-meta-category">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: categoryColor }}
                    />
                    {task.category}
                  </span>
                  {/* Pull, not push: offered on the task itself once it has
                      been put off repeatedly, never as a notification. */}
                  {isStuck(task) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStuckHelpTask(task);
                      }}
                      className="-my-0.5 rounded-full px-1.5 text-[var(--accent-text)] underline decoration-dotted underline-offset-2 hover:bg-[var(--accent-dim)]"
                    >
                      What&apos;s in the way?
                    </button>
                  )}
                </div>
              </div>

              {/* Actions: revealed on hover/focus with a fine pointer,
                  always visible on touch (.row-actions). Swipe covers
                  delete on phones, so the trash button is desktop-only. */}
              <div className="row-actions -my-1 flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTimer({
                      taskId: task.id,
                      taskTitle: task.title,
                      firstStep: task.first_step,
                    });
                  }}
                  title="Start focus session"
                  aria-label={`Start focus session: ${shortTitle}`}
                  className="task-action task-action-play"
                >
                  <UiIcon
                    size={14}
                    strokeWidth={0}
                    className="fill-current"
                    icon={Play}
                  />
                </button>
                <button
                  type="button"
                  onClick={handleHoverDeleteClick}
                  aria-label={`Move ${shortTitle} to trash`}
                  title="Move to trash"
                  className="task-action task-action-danger hidden md:flex"
                >
                  <UiIcon size={15} icon={Trash2} />
                </button>
              </div>
            </div>
          </GlassCard>
        </m.div>
      </m.div>
    );
  },
  (prevProps, nextProps) => {
    // 1. Check simple properties passed directly to the card
    if (prevProps.completing !== nextProps.completing) return false;

    // 2. Shallow check task fields
    const prevTask = prevProps.task;
    const nextTask = nextProps.task;

    if (!prevTask || !nextTask) return prevTask === nextTask;

    // Primitive comparisons
    if (
      prevTask.id !== nextTask.id ||
      prevTask.title !== nextTask.title ||
      prevTask.status !== nextTask.status ||
      prevTask.category !== nextTask.category ||
      prevTask.priority !== nextTask.priority ||
      prevTask.deadline !== nextTask.deadline ||
      prevTask.first_step !== nextTask.first_step ||
      prevTask.recurrence !== nextTask.recurrence ||
      prevTask.time_spent_minutes !== nextTask.time_spent_minutes ||
      prevTask.snoozed_until !== nextTask.snoozed_until ||
      // Stuck-task help: the link comes and goes with these.
      prevTask.defer_count !== nextTask.defer_count ||
      prevTask.first_deferred_at !== nextTask.first_deferred_at ||
      prevTask.stuck_dismissed_until !== nextTask.stuck_dismissed_until
    ) {
      return false;
    }

    // Reference/Shallow-array comparison of subtasks
    const prevSub = prevTask.subtasks;
    const nextSub = nextTask.subtasks;
    if (prevSub !== nextSub) {
      const prevList = readSubtasks(prevSub);
      const nextList = readSubtasks(nextSub);
      if (prevList.length !== nextList.length) return false;
      for (let i = 0; i < prevList.length; i++) {
        if (
          prevList[i].completed !== nextList[i].completed ||
          prevList[i].text !== nextList[i].text
        ) {
          return false;
        }
      }
    }

    return true;
  },
);

TaskCard.displayName = "TaskCard";
