"use client";
import React, { useMemo, useState } from "react";
import { m, useMotionValue, useTransform, animate } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Check, Clock, Play, Timer, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatRRule } from "@/lib/utils";
import { DEFAULT_DO_COLORS } from "@/lib/constants";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useHaptics } from "@/hooks/useHaptics";
import { moveItemToTrashPatch, restoreItemPatch } from "@/lib/item-lifecycle";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

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

function formatTimeSpent(minutes: number | undefined | null) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
    peopleMap,
  }: {
    /* @todo: Untyped usage justified per TOOL-01 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    task: any;
    completing: string | null;
    completeTask: (e: React.MouseEvent, id: string) => void;
    /* @todo: Untyped usage justified per TOOL-01 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    openEditPanel: (task: any) => void;
    fetchTasks: () => void;
    peopleMap?: Record<
      string,
      { initials: string | null; color: string | null; name: string }
    >;
  }) => {
    const userSettings = useAppStore((s) => s.userSettings);
    const setActiveTimer = useAppStore((s) => s.setActiveTimer);
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
    const subtasks: { completed: boolean }[] = task.subtasks || [];
    const completedSubtasks = subtasks.filter((st) => st.completed).length;
    const priority = Number(task.priority) || 4;

    const priorityDotColor =
      priority === 1
        ? "#ef4444" // red
        : priority === 2
          ? "#eab308" // yellow
          : priority === 3
            ? "#22c55e" // green
            : "var(--text-muted)"; // grey

    const priorityGlow =
      priority === 1
        ? "0 0 6px rgba(239, 68, 68, 0.5)"
        : priority === 2
          ? "0 0 6px rgba(234, 179, 8, 0.5)"
          : "none";
    const isCompleting = completing === task.id;

    /* BUG-44 — swipe and hover trash button share one soft-delete path:
       optimistic cache removal → moveItemToTrashPatch() → toast with Undo.
       DS-11: soft delete never shows a confirmation dialog. */
    const handleTaskDelete = async () => {
      // Save current caches for possible rollback
      const previousTasks = queryClient.getQueryData<any[]>(["tasks"]);
      const previousDashboard = queryClient.getQueryData<any>(["dashboard"]);

      // Optimistically update ["tasks"]
      queryClient.setQueryData<any[]>(
        ["tasks"],
        (old) => old?.filter((t) => t.id !== task.id) ?? [],
      );

      // Optimistically update ["dashboard"]
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData<any>(["dashboard"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          /* @todo: Untyped usage justified per TOOL-01 */
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tasks: old.tasks?.filter((t: any) => t.id !== task.id) ?? [],
        };
      });

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
              const currentTasks = queryClient.getQueryData<any[]>(["tasks"]);
              const currentDashboard = queryClient.getQueryData<any>([
                "dashboard",
              ]);

              // Optimistic restore
              queryClient.setQueryData<any[]>(["tasks"], (old) => [
                ...(old ?? []),
                task,
              ]);
              /* @todo: Untyped usage justified per TOOL-01 */
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              queryClient.setQueryData<any>(["dashboard"], (old: any) => {
                if (!old) return old;
                return {
                  ...old,
                  tasks: [...(old.tasks ?? []), task],
                };
              });

              try {
                const { error: undoError } = await supabase
                  .from("items")
                  .update(restoreItemPatch("active"))
                  .eq("id", task.id);
                if (undoError) throw undoError;
                fetchTasks();
              } catch {
                // Rollback undo
                queryClient.setQueryData(["tasks"], currentTasks);
                queryClient.setQueryData(["dashboard"], currentDashboard);
                toast.error("Failed to restore task");
              }
            },
          },
        });
      } catch {
        // Rollback on failure
        queryClient.setQueryData(["tasks"], previousTasks);
        queryClient.setQueryData(["dashboard"], previousDashboard);

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
      } else {
        animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
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

    return (
      <m.div
        layout
        layoutId={task.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{
          opacity: isCompleting ? 0.6 : 1,
          y: 0,
          scale: isCompleting ? 0.98 : 1,
          filter: isCompleting ? "blur(1px)" : "blur(0px)",
        }}
        exit={{
          opacity: 0,
          scale: 0.95,
          x: -20,
          filter: "blur(4px)",
          transition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
        }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="task-card-wrapper group relative rounded-2xl"
      >
        {/* Swipe-to-complete reveal layer */}
        <m.div
          className="absolute inset-0 flex items-center justify-start overflow-hidden rounded-2xl pl-5"
          style={{
            background:
              "linear-gradient(-90deg, transparent 0%, rgba(74,222,128,0.15) 60%, rgba(34,197,94,0.25) 100%)",
            opacity: completeOpacity,
          }}
        >
          <m.div style={{ scale: completeScale }}>
            <UiIcon className="h-5 w-5 text-green-400" icon={Check} />
          </m.div>
        </m.div>

        {/* Swipe-to-delete reveal layer */}
        <m.div
          className="absolute inset-0 flex items-center justify-end overflow-hidden rounded-2xl pr-5"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
            opacity: deleteOpacity,
          }}
        >
          <m.div style={{ scale: deleteScale }}>
            <UiIcon className="h-5 w-5 text-red-400" icon={Trash2} />
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
          <GlassCard
            onClick={() => openEditPanel(task)}
            className={cn(
              "group relative cursor-pointer !rounded-2xl p-4 transition-all",
              isOverdue && "border-[rgba(248,113,113,0.3)]",
              isCompleting &&
                "border-[rgba(74,222,128,0.4)] bg-[rgba(74,222,128,0.06)]",
            )}
          >
            {priority < 4 && (
              <div
                className="absolute top-3 right-9 h-2 w-2 rounded-full"
                style={{
                  background: priorityDotColor,
                  boxShadow: priorityGlow,
                }}
              />
            )}

            {/* BUG-44 — hover/focus trash affordance (desktop pointer users).
                Stops propagation so the edit panel doesn't open on delete. */}
            <button
              type="button"
              onClick={handleHoverDeleteClick}
              aria-label={`Move ${String(task.title ?? "task").slice(0, 40)} to trash`}
              className="absolute top-2 right-2 hidden h-7 w-7 items-center justify-center rounded-lg text-red-400 opacity-0 transition-opacity hover:bg-[rgba(248,113,113,0.15)] focus-visible:opacity-100 md:flex"
            >
              <UiIcon className="h-4 w-4" icon={Trash2} />
            </button>

            <div className="flex items-start gap-3">
              <m.button
                onClick={(e) => completeTask(e, task.id)}
                animate={
                  isCompleting
                    ? {
                        scale: [1, 1.2, 1],
                        backgroundColor: "rgba(74,222,128,1)",
                      }
                    : {}
                }
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn(
                  "checkbox mt-0.5 shrink-0",
                  isCompleting && "checked",
                )}
              >
                {isCompleting && (
                  <UiIcon
                    className="h-3.5 w-3.5 text-white"
                    strokeWidth={3}
                    icon={Check}
                  />
                )}
              </m.button>

              <div className="min-w-0 flex-1 pr-4">
                <div className="mb-1 flex items-center gap-2">
                  {isOverdue && (
                    <span
                      className="text-caption font-bold tracking-widest uppercase"
                      style={{ color: "var(--space-do)" }}
                    >
                      Overdue
                    </span>
                  )}
                  {!isOverdue && label === "Today" && (
                    <span
                      className="text-caption font-bold tracking-widest uppercase"
                      style={{ color: "var(--status-today)" }}
                    >
                      Due Today
                    </span>
                  )}
                  <span
                    className="text-caption font-semibold capitalize"
                    style={{
                      color:
                        (userSettings?.do_category_colors?.[task.category] ||
                          DEFAULT_DO_COLORS[task.category]) ??
                        "var(--text-muted)",
                    }}
                  >
                    {task.category}
                  </span>
                </div>

                <m.p
                  className="text-body-lg leading-snug font-semibold"
                  style={{ color: "var(--text-1)" }}
                  animate={
                    isCompleting
                      ? {
                          textDecoration: "line-through",
                          textDecorationColor: "rgba(74,222,128,0.7)",
                          color: "var(--text-3)",
                        }
                      : {}
                  }
                  transition={{ duration: 0.25 }}
                >
                  {task.title}
                </m.p>

                {task.first_step && (
                  <p
                    className="text-ui mt-1"
                    style={{
                      color: isOverdue
                        ? "var(--space-do)"
                        : "var(--space-think)",
                    }}
                  >
                    → {task.first_step}
                  </p>
                )}

                {task.recurrence && (
                  <p
                    className="text-ui mt-1"
                    style={{ color: "var(--text-3)" }}
                  >
                    ⇆ {formatRRule(task.recurrence)}
                  </p>
                )}

                {subtasks.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className="h-1 flex-1 overflow-hidden rounded-full"
                      style={{ background: "var(--surface-1)" }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(completedSubtasks / subtasks.length) * 100}%`,
                          background: "var(--text-3)",
                        }}
                      />
                    </div>
                    <span
                      className="text-caption shrink-0 font-medium"
                      style={{ color: "var(--text-3)" }}
                    >
                      {completedSubtasks}/{subtasks.length}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div
              className="mt-4 flex items-center justify-between pt-3"
              style={{ borderTop: "0.5px solid var(--border-subtle)" }}
            >
              <div className="flex items-center gap-3">
                <span className="text-ui" style={{ color: "var(--text-3)" }}>
                  {label && label !== "Overdue" && label !== "Today"
                    ? label
                    : task.deadline
                      ? ""
                      : "No deadline"}
                </span>

                {/* Linked People Avatars */}
                {peopleMap &&
                  task.linked_people_ids &&
                  task.linked_people_ids.length > 0 && (
                    <div
                      className="flex -space-x-1.5"
                      title={task.linked_people_ids
                        .map((id: string) => peopleMap[id]?.name)
                        .filter(Boolean)
                        .join(", ")}
                    >
                      {task.linked_people_ids.map(
                        (id: string, index: number) => {
                          const person = peopleMap[id];
                          if (!person) return null;
                          return (
                            <div
                              key={id}
                              className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--color-background)] text-[9px] font-bold text-white"
                              style={{
                                backgroundColor: person.color as string,
                                zIndex: 10 - index,
                              }}
                            >
                              {person.initials ||
                                person.name
                                  .split(" ")
                                  .map((w: string) => w[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()}
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
              </div>

              <div className="flex items-center gap-2">
                {task.time_spent_minutes > 0 && (
                  <div
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
                    style={{ background: "rgba(229,180,30,0.08)" }}
                    title="Time spent on this task"
                  >
                    <UiIcon
                      size={12}
                      strokeWidth={1.5}
                      style={{ color: "var(--accent)" }}
                      icon={Timer}
                    />
                    <span
                      className="text-caption font-bold"
                      style={{ color: "var(--accent)" }}
                    >
                      {formatTimeSpent(task.time_spent_minutes)}
                    </span>
                  </div>
                )}
                {task.snoozed_until &&
                  new Date(task.snoozed_until) > new Date() && (
                    <div
                      className="flex items-center gap-1 rounded-md px-2 py-1"
                      style={{
                        background: "var(--surface-1)",
                        border: "0.5px solid var(--border-default)",
                      }}
                    >
                      <UiIcon
                        size={12}
                        strokeWidth={1.5}
                        style={{ color: "var(--text-3)" }}
                        icon={Clock}
                      />
                      <span
                        className="text-caption"
                        style={{ color: "var(--text-3)" }}
                      >
                        {new Date(task.snoozed_until).toLocaleTimeString(
                          "en-US",
                          { hour: "numeric", minute: "2-digit" },
                        )}
                      </span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();

                          const previousTasks = queryClient.getQueryData<any[]>(
                            ["tasks"],
                          );
                          const previousDashboard =
                            queryClient.getQueryData<any>(["dashboard"]);

                          // Optimistically set task.snoozed_until = null in ["tasks"]
                          /* @todo: Untyped usage justified per TOOL-01 */
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          queryClient.setQueryData<any[]>(
                            ["tasks"],
                            (old: any) =>
                              /* @todo: Untyped usage justified per TOOL-01 */
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              old?.map((t: any) =>
                                t.id === task.id
                                  ? { ...t, snoozed_until: null }
                                  : t,
                              ) ?? [],
                          );

                          // Optimistically set task.snoozed_until = null in ["dashboard"]
                          /* @todo: Untyped usage justified per TOOL-01 */
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          queryClient.setQueryData<any>(
                            ["dashboard"],
                            (old: any) => {
                              if (!old) return old;
                              return {
                                ...old,
                                /* @todo: Untyped usage justified per TOOL-01 */
                                 
                                tasks:
                                  old.tasks?.map((t: any) =>
                                    t.id === task.id
                                      ? { ...t, snoozed_until: null }
                                      : t,
                                  ) ?? [],
                              };
                            },
                          );

                          try {
                            markMutation();
                            const { error } = await supabase
                              .from("items")
                              .update({ snoozed_until: null })
                              .eq("id", task.id);
                            if (error) throw error;
                            fetchTasks();
                          } catch {
                            // Rollback on failure
                            queryClient.setQueryData(["tasks"], previousTasks);
                            queryClient.setQueryData(
                              ["dashboard"],
                              previousDashboard,
                            );
                            toast.error("Failed to cancel snooze");
                          }
                        }}
                        className="ml-1"
                        style={{ color: "var(--text-3)" }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                <Button
                  variant="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTimer({ taskId: task.id, taskTitle: task.title });
                  }}
                  className=""
                  style={{
                    background: "rgba(229,180,30,0.08)",
                    color: "var(--accent)",
                    border: "none",
                  }}
                  title="Start focus session"
                >
                  <UiIcon
                    size={14}
                    strokeWidth={0}
                    className="fill-current"
                    icon={Play}
                  />
                </Button>
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

    // 2. Shallow check peopleMap if references changed
    if (prevProps.peopleMap !== nextProps.peopleMap) {
      if (!prevProps.peopleMap || !nextProps.peopleMap) return false;
      const prevKeys = Object.keys(prevProps.peopleMap);
      const nextKeys = Object.keys(nextProps.peopleMap);
      if (prevKeys.length !== nextKeys.length) return false;
      for (const key of prevKeys) {
        const p = prevProps.peopleMap[key];
        const n = nextProps.peopleMap[key];
        if (
          !p ||
          !n ||
          p.name !== n.name ||
          p.initials !== n.initials ||
          p.color !== n.color
        ) {
          return false;
        }
      }
    }

    // 3. Shallow check task fields
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
      prevTask.snoozed_until !== nextTask.snoozed_until
    ) {
      return false;
    }

    // Reference/Shallow-array comparison of linked_people_ids
    const prevPeople = prevTask.linked_people_ids;
    const nextPeople = nextTask.linked_people_ids;
    if (prevPeople !== nextPeople) {
      if (!prevPeople || !nextPeople) return false;
      if (prevPeople.length !== nextPeople.length) return false;
      for (let i = 0; i < prevPeople.length; i++) {
        if (prevPeople[i] !== nextPeople[i]) return false;
      }
    }

    // Reference/Shallow-array comparison of subtasks
    const prevSub = prevTask.subtasks;
    const nextSub = nextTask.subtasks;
    if (prevSub !== nextSub) {
      if (!prevSub || !nextSub) return false;
      if (prevSub.length !== nextSub.length) return false;
      for (let i = 0; i < prevSub.length; i++) {
        if (
          prevSub[i].completed !== nextSub[i].completed ||
          prevSub[i].text !== nextSub[i].text
        ) {
          return false;
        }
      }
    }

    return true;
  },
);

TaskCard.displayName = "TaskCard";
