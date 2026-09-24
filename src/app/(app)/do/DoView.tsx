"use client";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TaskRecord } from "@/lib/task-cache";
import { useUserId } from "@/components/providers/SessionProvider";
import { PageHeader } from "@/components/ui/PageHeader";

import React, {
  use,
  useSyncExternalStore,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { m, AnimatePresence } from "framer-motion";
import { createClient, safeMutate } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TaskCard } from "@/components/features/TaskCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Clock,
  Zap,
  Calendar,
  Wind,
  CheckCircle2,
  Trash2,
  Archive,
} from "lucide-react";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useHaptics } from "@/hooks/useHaptics";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useAppStore } from "@/store/useAppStore";
import { COMPLETE_HOLD_MS, resolveCategoryColor } from "@/lib/constants";
// INFRA-19: all status writes on entity tables go through item-lifecycle.ts
import { completeTaskPatch, uncompleteTaskPatch } from "@/lib/item-lifecycle";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import dynamic from "next/dynamic";
import { withPreload } from "@/lib/preloadable";
import { fetchActiveTasks } from "@/lib/do-tasks";

// Heavy, closed-by-default surfaces loaded on demand (same pattern as
// DynamicModals) so /do's initial bundle and hydration exclude them.
export const TaskAddPanel = withPreload(
  dynamic(
    () =>
      import("@/components/features/TaskAddPanel").then((m) => ({
        default: m.TaskAddPanel,
      })),
    { ssr: false, loading: () => null },
  ),
  () => import("@/components/features/TaskAddPanel"),
);
export const CalendarView = withPreload(
  dynamic(
    () =>
      import("@/components/features/calendar/CalendarView").then((m) => ({
        default: m.CalendarView,
      })),
    { ssr: false, loading: () => null },
  ),
  () => import("@/components/features/calendar/CalendarView"),
);

/**
 * The task row shape comes from the generated Database types rather than a
 * hand-written local copy — two divergent copies used to exist (here and on
 * the home dashboard) and neither matched the column nullability.
 */
type Task = TaskRecord;

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
  }) => (
    <section aria-label={title} className="min-w-0 flex-1">
      {/* Section header: quiet, Things-style — tinted icon, title, count. */}
      <div className="mb-2.5 flex h-7 items-center gap-2 px-1">
        <Icon
          aria-hidden="true"
          className="h-3.5 w-3.5"
          style={{ color: accent }}
        />
        <h2 className="text-[length:var(--text-ui)] font-semibold text-[var(--text-1)]">
          {title}
        </h2>
        {colTasks.length > 0 && (
          <span className="text-[length:var(--text-meta)] text-[var(--text-3)] tabular-nums">
            {colTasks.length}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {colTasks.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] py-6 text-center text-[length:var(--text-ui)] text-[var(--text-3)]">
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
                />
              </m.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  ),
);
Column.displayName = "Column";

const subscribeNoop = () => () => {};

/**
 * Resolves the server's streamed tasks, then renders the view with plain
 * data. Kept separate on purpose: when a component suspends on use() during
 * server rendering and is replayed, nuqs's useQueryState (useOptimistic
 * underneath) came back without a URLSearchParams whenever the URL had a
 * query string — "initialSearchParams.getAll is not a function", and React
 * fell back to client rendering for /do?view=... . Nothing below this
 * boundary suspends.
 */
export function DoView({
  tasksPromise,
}: {
  /** Started by the server page and streamed; null when that fetch failed. */
  tasksPromise: Promise<Task[] | null>;
}) {
  const queryClient = useQueryClient();
  // Returning to Do renders from the cache at once; only a cold load waits
  // on the server's streamed tasks, already resolved by hydration.
  const serverTasks = queryClient.getQueryData<Task[]>(["tasks"])
    ? undefined
    : (use(tasksPromise) ?? undefined);
  return <DoBoard serverTasks={serverTasks} />;
}

function DoBoard({ serverTasks }: { serverTasks: Task[] | undefined }) {
  const userId = useUserId();
  const supabase = useMemo(() => createClient(), []);
  const initialFilter = "all";

  const queryClient = useQueryClient();
  // Grouping (Overdue/Today) and TaskCard dates use the device's timezone, so
  // the list is first rendered after hydration, never on the server.
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
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
    isLoading,
    refetch: fetchTasks,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchActiveTasks(supabase, userId),
    initialData: serverTasks,
  });
  const loading = !hydrated || isLoading;

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
    ]).withDefault("board"),
  );

  // Restore the last-used view after hydration. Reading localStorage during
  // render made the server ("board") and client (stored view) disagree,
  // which React reported as a hydration mismatch. An explicit ?view= in the
  // URL still wins.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("view")) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("presense_do_view");
    } catch {
      return;
    }
    if (stored === "today" || stored === "calendar") void setViewMode(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleViewMode = (mode: "board" | "today" | "calendar") => {
    setViewMode(mode);
    localStorage.setItem("presense_do_view", mode);
  };

  const [showArchive, setShowArchive] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);

  const fetchArchived = useCallback(async () => {
    // INFRA-18: explicit user_id filter for planner index usage.
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "done")
      .order("completed_at", { ascending: false });
    setArchivedTasks((data as Task[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showArchive) fetchArchived();
  }, [fetchArchived, showArchive]);

  // ["tasks"] is invalidated by useRealtime("items") itself.
  useRealtime("items");

  const completeTask = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();

      // Set completing state — TaskCard shows the checkmark animation
      setCompleting(id);
      haptics.success();

      // Let the completion moment (pop, tick, strike-through; globals.css)
      // finish before AnimatePresence folds the row away.
      setTimeout(() => {
        queryClient.setQueryData<Task[]>(["tasks"], (old) =>
          old?.filter((t) => t.id !== id),
        );
        setCompleting(null);
      }, COMPLETE_HOLD_MS);

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
        () => supabase.from("items").update(uncompleteTaskPatch()).eq("id", id),
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
          <>
            <button
              type="button"
              onClick={() => setShowArchive(!showArchive)}
              aria-pressed={showArchive}
              aria-label="Archive"
              className="chip max-sm:!px-2.5"
            >
              <UiIcon className="h-4 w-4" icon={Archive} />
              <span className="hidden sm:inline">Archive</span>
            </button>
            <Button
              variant="primary"
              size="sm"
              // PERF-20: start fetching the add-panel chunk on hover/focus so
              // the panel opens without paying the chunk transfer/eval cost
              onMouseEnter={() => TaskAddPanel.preload()}
              onFocus={() => TaskAddPanel.preload()}
              // PERF-20 (mobile): onMouseEnter/onFocus never fire from a touch
              // tap, so mobile taps missed the pre-warm. onTouchStart fires
              // before onClick on touch devices, giving the same head start.
              onTouchStart={() => TaskAddPanel.preload()}
              onClick={() => {
                setTaskToEdit(null);
                setInitialDeadline(null);
                setIsPanelOpen(true);
              }}
            >
              <UiIcon className="h-4 w-4" icon={Plus} /> Add task
            </Button>
          </>
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
              onMouseEnter: () => CalendarView.preload(),
              onFocus: () => CalendarView.preload(),
            },
          ]}
          value={viewMode}
          onChange={(val) => toggleViewMode(val)}
          label="Task view"
          className="segmented-fill"
        />
        {/* Category filters: scroll sideways on phones, sit to the right
            of the view switch on desktop. */}
        <div
          role="group"
          aria-label="Filter by category"
          className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:justify-end md:overflow-visible md:px-0"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              aria-pressed={categoryFilter === cat}
              className="chip shrink-0 capitalize"
            >
              {cat}
            </button>
          ))}
        </div>
      </PageHeader>

      {!showArchive && viewMode !== "calendar" && (
        <ContextualTip
          id="do_space"
          title="Sorted by deadline"
          description="Deadlines sort your tasks for you. Keep each one small enough to start today."
        />
      )}

      {loading ? (
        <PageSkeleton count={5} type="task" />
      ) : showArchive ? (
        <div className="space-y-3">
          <h2 className="text-label mb-4 text-[var(--text-3)]">
            Archived tasks
          </h2>
          {archivedTasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No completed tasks yet"
              description="When you finish tasks, they will appear here in your archive."
              className="border-[var(--border-subtle)] bg-transparent"
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
                  className="flex items-center justify-between p-4 opacity-70 transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:opacity-100 hover:shadow-[var(--shadow-card-hover)]"
                >
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="text-caption font-semibold text-[var(--text-muted)] capitalize"
                        style={{
                          color: resolveCategoryColor(
                            task.category,
                            userSettings?.do_category_colors,
                            "var(--text-muted)",
                          ),
                        }}
                      >
                        {task.category}
                      </span>
                      <span className="text-caption text-[var(--text-muted)]">
                        • Completed{" "}
                        {new Date(task.completed_at!).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-1)] line-through">
                      {task.title}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => restoreTask(task.id)}
                  >
                    Restore
                  </Button>
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
              ? "grid grid-cols-1 items-start md:grid-cols-2"
              : "flex w-full flex-col space-y-7",
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
          />
          {overdue.length === 0 && today.length === 0 && (
            <EmptyState
              icon={Wind}
              title="You're all caught up"
              description="Nothing is due today. Add a task or plan tomorrow."
              pointer={
                // BUG-08 / CONF-10 (Option C): thin pointer to the global trash
                <Link
                  href="/trash?filter=item"
                  className="underline underline-offset-2 hover:text-[var(--color-accent)]"
                >
                  <UiIcon
                    className="mr-1 inline h-3 w-3 align-[-2px]"
                    icon={Trash2}
                  />
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
              ? "grid grid-cols-1 items-start md:grid-cols-2 xl:grid-cols-4"
              : "flex w-full flex-col space-y-7",
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
            />
          ) : null}
          {overdue.length === 0 &&
            today.length === 0 &&
            upcoming.length === 0 &&
            someday.length === 0 && (
              <EmptyState
                icon={Wind}
                title="You're all caught up"
                description="No tasks match this view. Add one to get started."
                className="md:col-span-2 xl:col-span-4"
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
