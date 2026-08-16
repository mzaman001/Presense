"use client";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { m, AnimatePresence } from "framer-motion";
import { createClient, safeMutate } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TaskCard } from "@/components/features/TaskCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, Zap, Calendar, Wind, CheckCircle2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useHaptics } from "@/hooks/useHaptics";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useAppStore } from "@/store/useAppStore";
import { DEFAULT_DO_COLORS } from "@/lib/constants";
// INFRA-19: all status writes on entity tables go through item-lifecycle.ts
import {
  completeTaskPatch,
  uncompleteTaskPatch,
} from "@/lib/item-lifecycle";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import dynamic from "next/dynamic";

// Heavy, closed-by-default surfaces loaded on demand (same pattern as
// DynamicModals) so /do's initial bundle and hydration exclude them.
export const TaskAddPanel = dynamic(
  () =>
    import("@/components/features/TaskAddPanel").then((m) => ({
      default: m.TaskAddPanel,
    })),
  { ssr: false, loading: () => null },
);
export const CalendarView = dynamic(
  () =>
    import("@/components/features/calendar/CalendarView").then((m) => ({
      default: m.CalendarView,
    })),
  { ssr: false, loading: () => null },
);

interface Task {
  id: string;
  title: string;
  first_step: string | null;
  ifthen_trigger: string | null;
  deadline: string | null;
  status: string;
  category: string;
  snoozed_until?: string | null;
  recurrence?: string | null;
  linked_people_ids?: string[] | null;
  start_date?: string | null;
  completed_at?: string | null;
}

const Column = React.memo(
  ({
    title,
    tasks: colTasks,
    accent,
    icon: Icon,
    completing,
    completeTask,
    openEditPanel,
    fetchTasks,
    newTaskIds,
    peopleMap,
  }: {
    title: string;
    tasks: Task[];
    accent: string;
    icon: React.ElementType;
    completing: string | null;
    completeTask: (e: React.MouseEvent, id: string) => void;
    openEditPanel: (task: Task) => void;
    fetchTasks: () => void;
    newTaskIds: Set<string>;
    peopleMap?: Record<
      string,
      { initials: string | null; color: string | null; name: string }
    >;
  }) => (
    <div className="min-w-0 flex-1">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        <h2 className="text-sm font-semibold text-[var(--color-text-1)]">
          {title}
        </h2>
        {colTasks.length > 0 && (
          <Badge
            variant={
              title.toLowerCase() as React.ComponentProps<
                typeof Badge
              >["variant"]
            }
          >
            {colTasks.length}
          </Badge>
        )}
      </div>
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {colTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] py-8 text-center text-sm text-[var(--color-text-3)]">
              Nothing here
            </div>
          ) : (
            colTasks.map((t) => (
              <m.div
                key={t.id}
                layout
                initial={
                  newTaskIds.has(t.id)
                    ? { opacity: 0, y: -12, scale: 0.97 }
                    : false
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <TaskCard
                  task={t}
                  completing={completing}
                  completeTask={completeTask}
                  openEditPanel={openEditPanel}
                  fetchTasks={fetchTasks}
                  peopleMap={peopleMap}
                />
              </m.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  ),
);
Column.displayName = "Column";

export default function DoPage() {
  const supabase = useMemo(() => createClient(), []);
  const initialFilter = "all";

  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useQueryState(
    "filter",
    parseAsString.withDefault(initialFilter),
  );
  const [completing, setCompleting] = useState<string | null>(null);
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());
  const prevTaskIdsRef = useRef<Set<string>>(new Set());
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [initialDeadline, setInitialDeadline] = useState<Date | null>(null);

  const userSettings = useAppStore((s) => s.userSettings);
  const isBoardView = userSettings?.default_view === "board";
  const haptics = useHaptics();

  const {
    data: tasks = [],
    isLoading: loading,
    refetch: fetchTasks,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      // INFRA-18: explicit user_id filter lets the planner use the
      // idx_items_user_status index directly instead of only the RLS policy.
      const { data: userSession } = await supabase.auth.getUser();
      if (!userSession?.user) return [];
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", userSession.user.id)
        .in("status", ["active", "overdue"])
        .order("priority", { ascending: true, nullsFirst: false })
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: peopleList = [], refetch: fetchPeopleList } = useQuery({
    queryKey: ["people_minimal"],
    queryFn: async () => {
      // INFRA-18: explicit user_id filter for planner index usage.
      const { data: userSession } = await supabase.auth.getUser();
      if (!userSession?.user) return [];
      const { data, error } = await supabase
        .from("people")
        .select("id, name, initials, color")
        .eq("user_id", userSession.user.id);
      if (error) throw error;
      return data || [];
    },
  });

  const peopleMap = useMemo(() => {
    const map: Record<
      string,
      { initials: string | null; color: string | null; name: string }
    > = {};
    for (const p of peopleList) {
      map[p.id] = p;
    }
    return map;
  }, [peopleList]);

  useEffect(() => {
    const currentIds = new Set(tasks.map((t) => t.id));
    const added = tasks
      .filter((t) => !prevTaskIdsRef.current.has(t.id))
      .map((t) => t.id);
    if (added.length > 0) {
      setNewTaskIds((prev) => new Set([...prev, ...added]));
      setTimeout(() => {
        setNewTaskIds((prev) => {
          const next = new Set(prev);
          added.forEach((id) => next.delete(id));
          return next;
        });
      }, 400);
    }
    prevTaskIdsRef.current = currentIds;
  }, [tasks]);

  const [viewMode, setViewMode] = useQueryState<"board" | "today" | "calendar">(
    "view",
    parseAsStringEnum<"board" | "today" | "calendar">([
      "board",
      "today",
      "calendar",
    ]).withDefault(
      (typeof window !== "undefined" &&
        (localStorage.getItem("presense_do_view") as
          "board" | "today" | "calendar")) ||
        "board",
    ),
  );

  const toggleViewMode = (mode: "board" | "today" | "calendar") => {
    setViewMode(mode);
    localStorage.setItem("presense_do_view", mode);
  };

  const [showArchive, setShowArchive] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);

  const fetchArchived = useCallback(async () => {
    // INFRA-18: explicit user_id filter for planner index usage.
    const { data: userSession } = await supabase.auth.getUser();
    if (!userSession?.user) return [];
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", userSession.user.id)
      .eq("status", "done")
      .order("completed_at", { ascending: false });
    setArchivedTasks((data as Task[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showArchive) fetchArchived();
  }, [fetchArchived, showArchive]);

  useRealtime("items", fetchTasks);
  useRealtime("people", fetchPeopleList);

  const completeTask = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();

      // Set completing state — TaskCard shows the checkmark animation
      setCompleting(id);
      haptics.success();

      // Delay removal so AnimatePresence can play the exit animation
      setTimeout(() => {
        queryClient.setQueryData<Task[]>(["tasks"], (old) =>
          old?.filter((t) => t.id !== id),
        );
        setCompleting(null);
      }, 400);

      try {
        const { error } = await supabase
          .from("items")
          .update(completeTaskPatch())
          .eq("id", id);
        if (error) throw error;

        toast.success("Task completed", {
          action: {
            label: "Undo",
            onClick: async () => {
              const { success } = await safeMutate(
                () =>
                  supabase
                    .from("items")
                    .update(uncompleteTaskPatch())
                    .eq("id", id),
                "Failed to restore task",
              );
              if (!success) return;
              fetchTasks();
              toast.success("Task restored");
            },
          },
          duration: 5000,
        });
        if (showArchive) fetchArchived();
      } catch (err: unknown) {
        setCompleting(null);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.error("Failed to complete task", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [haptics, queryClient, supabase, fetchTasks, showArchive, fetchArchived],
  );

  const restoreTask = async (id: string) => {
    try {
      useAppStore.getState().markMutation();
      const { success } = await safeMutate(
        () =>
          supabase
            .from("items")
            .update(uncompleteTaskPatch())
            .eq("id", id),
        "Failed to restore task",
      );
      if (!success) return;
      fetchTasks();
      fetchArchived();
      toast.success("Task restored");
    } catch {
      toast.error("Failed to restore task");
    }
  };

  const openEditPanel = useCallback((task: Task) => {
    setTaskToEdit(task);
    setInitialDeadline(null);
    setIsPanelOpen(true);
  }, []);

  const openCreatePanelAt = (deadline: Date) => {
    setTaskToEdit(null);
    setInitialDeadline(deadline);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => {
      setTaskToEdit(null);
      setInitialDeadline(null);
    }, 300);
  };

  // PERF-15: single-pass bucketing. The previous implementation ran four
  // consecutive filter passes over `filtered` — each constructing a new
  // Date(t.deadline) and calling toDateString() per task per pass, and
  // producing fresh array identities every render (defeating the memoized
  // Column/TaskCard tree). Now one derivation loop builds all four buckets
  // with exactly one date parse per task, and the result is memoized by
  // input identity so the buckets keep referential identity across renders
  // where `tasks` and `categoryFilter` are unchanged.
  const bucketed = useMemo(() => {
    const now = new Date();
    const started: Task[] = [];

    // Exclude tasks whose start_date is in the future
    for (const t of tasks) {
      if (!t.start_date || new Date(t.start_date) <= now) started.push(t);
    }

    const buckets = {
      overdue: [] as Task[],
      today: [] as Task[],
      upcoming: [] as Task[],
      someday: [] as Task[],
    };

    for (const t of started) {
      const isActiveOrOverdue = t.status === "active" || t.status === "overdue";
      if (categoryFilter === "all") {
        if (!isActiveOrOverdue) continue;
      } else if (categoryFilter === "inbox") {
        if (t.status !== "inbox") continue;
      } else if (categoryFilter === "today") {
        if (!t.deadline || !isActiveOrOverdue) continue;
        const d = new Date(t.deadline);
        if (!(d <= now || d.toDateString() === now.toDateString())) continue;
      } else if (t.category !== categoryFilter || !isActiveOrOverdue) {
        continue;
      }

      if (!t.deadline) {
        buckets.someday.push(t);
      } else {
        const d = new Date(t.deadline);
        if (d < now) buckets.overdue.push(t);
        else if (d.toDateString() === now.toDateString()) buckets.today.push(t);
        else buckets.upcoming.push(t);
      }
    }

    return buckets;
  }, [tasks, categoryFilter]);

  const { overdue, today, upcoming, someday } = bucketed;

  const doCats = userSettings?.do_categories || [
    "work",
    "study",
    "personal",
    "errand",
    "health",
  ];
  const CATEGORIES = ["all", ...doCats];

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Do"
        actions={
          <Button
            variant="secondary"
            // PERF-20: start fetching the add-panel chunk on hover/focus so
            // the panel opens without paying the chunk transfer/eval cost
            onMouseEnter={() => (TaskAddPanel as typeof TaskAddPanel & { preload: () => void }).preload()}
            onFocus={() => (TaskAddPanel as typeof TaskAddPanel & { preload: () => void }).preload()}
            onClick={() => {
              setTaskToEdit(null);
              setInitialDeadline(null);
              setIsPanelOpen(true);
            }}
            className="!border-[var(--accent-border)] !bg-[var(--accent-dim)] !text-[var(--accent)] hover:!bg-[var(--accent-dim-hover)]"
          >
            <UiIcon className="h-4 w-4" icon={Plus} /> Add task
          </Button>
        }
      >
        <SegmentedControl
          options={[
            { label: "Board", value: "board" },
            { label: "Today", value: "today" },
            {
              label: "Calendar",
              value: "calendar",
              // PERF-20: fetch the calendar-view chunk on hover/focus so
              // switching to the calendar is already warm
              onMouseEnter: () => (CalendarView as typeof CalendarView & { preload: () => void }).preload(),
              onFocus: () => (CalendarView as typeof CalendarView & { preload: () => void }).preload(),
            },
          ]}
          value={viewMode}
          onChange={(val) => toggleViewMode(val)}
        />
        <button
          onClick={() => setShowArchive(!showArchive)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            showArchive
              ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] text-[var(--color-background)]"
              : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]",
          )}
        >
          {showArchive ? "Hide Archive" : "Show Archive"}
        </button>
      </PageHeader>

      {!showArchive && viewMode !== "calendar" && (
        <ContextualTip
          id="do_space"
          title="Tasks that move"
          description="This is the Do space. Tasks are organized by deadline. Keep tasks small and actionable. Focus on starting them, not finishing them."
        />
      )}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs capitalize transition-all",
              categoryFilter === cat
                ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] font-semibold text-[var(--color-background)]"
                : "border-[var(--color-border)] text-[var(--color-text-3)] hover:border-[var(--color-border)]",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSkeleton count={5} type="task" />
      ) : showArchive ? (
        <div className="space-y-3">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-1)]">
            Archived Tasks
          </h2>
          {archivedTasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No completed tasks yet"
              description="When you finish tasks, they will appear here in your archive."
              className="border-[rgba(255,255,255,0.08)] bg-transparent"
            />
          ) : (
            archivedTasks
              .filter(
                (t) =>
                  categoryFilter === "all" || t.category === categoryFilter,
              )
              .map((task) => (
                <GlassCard
                  key={task.id}
                  className="flex items-center justify-between p-4 opacity-70 transition-opacity hover:opacity-100"
                >
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="text-caption font-semibold text-[rgba(255,255,255,0.35)] capitalize"
                        style={{
                          color:
                            (userSettings?.do_category_colors?.[
                              task.category
                            ] ||
                              DEFAULT_DO_COLORS[task.category]) ??
                            "rgba(255,255,255,0.35)",
                        }}
                      >
                        {task.category}
                      </span>
                      <span className="text-caption text-[rgba(255,255,255,0.35)]">
                        • Completed{" "}
                        {new Date(task.completed_at!).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-1)] line-through">
                      {task.title}
                    </p>
                  </div>
                  <button
                    onClick={() => restoreTask(task.id)}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    Restore
                  </button>
                </GlassCard>
              ))
          )}
        </div>
      ) : viewMode === "calendar" ? (
        <CalendarView
          tasks={tasks}
          onEditTask={openEditPanel}
          onCreateTaskAt={openCreatePanelAt}
          categoryFilter={categoryFilter}
        />
      ) : viewMode === "today" ? (
        <div
          className={cn(
            "gap-6",
            isBoardView
              ? "mx-auto grid max-w-3xl grid-cols-1 items-start md:grid-cols-2"
              : "mx-auto flex max-w-2xl flex-col space-y-8",
          )}
        >
          {overdue.length > 0 && (
            <Column
              title="Overdue"
              tasks={overdue}
              accent="var(--status-overdue)"
              icon={Zap}
              completing={completing}
              completeTask={completeTask}
              openEditPanel={openEditPanel}
              fetchTasks={fetchTasks}
              newTaskIds={newTaskIds}
              peopleMap={peopleMap}
            />
          )}
          <Column
            title="Today"
            tasks={today}
            accent="var(--status-today)"
            icon={Clock}
            completing={completing}
            completeTask={completeTask}
            openEditPanel={openEditPanel}
            fetchTasks={fetchTasks}
            newTaskIds={newTaskIds}
            peopleMap={peopleMap}
          />
          {overdue.length === 0 && today.length === 0 && (
            <EmptyState
              icon={Wind}
              title="You're all caught up"
              description="No tasks due today. Take a well-deserved break, or plan ahead for tomorrow."
              pointer={
                // BUG-08 / CONF-10 (Option C): thin pointer to the global trash
                <Link
                  href="/trash?filter=item"
                  className="underline underline-offset-2 hover:text-[var(--color-accent)]"
                >
                  <UiIcon className="mr-1 inline h-3 w-3 align-[-2px]" icon={Trash2} />
                  Check the trash for deleted tasks
                </Link>
              }
              className="md:col-span-2"
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    setTaskToEdit(null);
                    setInitialDeadline(null);
                    setIsPanelOpen(true);
                  }}
                  className="gap-2"
                >
                  <UiIcon size={16} icon={Plus} /> Add Task
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div
          className={cn(
            "gap-6",
            isBoardView
              ? "grid grid-cols-1 items-start md:grid-cols-3"
              : "mx-auto flex max-w-2xl flex-col space-y-8",
          )}
        >
          {overdue.length > 0 || isBoardView ? (
            <Column
              title="Overdue"
              tasks={overdue}
              accent="var(--status-overdue)"
              icon={Zap}
              completing={completing}
              completeTask={completeTask}
              openEditPanel={openEditPanel}
              fetchTasks={fetchTasks}
              newTaskIds={newTaskIds}
              peopleMap={peopleMap}
            />
          ) : null}
          {today.length > 0 || isBoardView ? (
            <Column
              title="Today"
              tasks={today}
              accent="var(--status-today)"
              icon={Clock}
              completing={completing}
              completeTask={completeTask}
              openEditPanel={openEditPanel}
              fetchTasks={fetchTasks}
              newTaskIds={newTaskIds}
              peopleMap={peopleMap}
            />
          ) : null}
          {upcoming.length > 0 || isBoardView ? (
            <Column
              title="Upcoming"
              tasks={upcoming}
              accent="var(--status-upcoming)"
              icon={Calendar}
              completing={completing}
              completeTask={completeTask}
              openEditPanel={openEditPanel}
              fetchTasks={fetchTasks}
              newTaskIds={newTaskIds}
              peopleMap={peopleMap}
            />
          ) : null}
          {someday.length > 0 || isBoardView ? (
            <Column
              title="Someday"
              tasks={someday}
              accent="var(--status-someday)"
              icon={Calendar}
              completing={completing}
              completeTask={completeTask}
              openEditPanel={openEditPanel}
              fetchTasks={fetchTasks}
              newTaskIds={newTaskIds}
              peopleMap={peopleMap}
            />
          ) : null}
          {overdue.length === 0 &&
            today.length === 0 &&
            upcoming.length === 0 &&
            someday.length === 0 && (
              <EmptyState
                icon={Wind}
                title="You're all caught up"
                description="No tasks in this view. Take a well-deserved break, or plan ahead."
                className="md:col-span-3"
                action={
                  <Button
                    variant="primary"
                    onClick={() => {
                      setTaskToEdit(null);
                      setInitialDeadline(null);
                      setIsPanelOpen(true);
                    }}
                    className="mx-auto gap-2"
                  >
                    <UiIcon size={16} icon={Plus} /> Add Task
                  </Button>
                }
              />
            )}
        </div>
      )}

      <TaskAddPanel
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        onTaskAdded={fetchTasks}
        taskToEdit={taskToEdit}
        initialDeadline={initialDeadline}
      />
    </div>
  );
}
