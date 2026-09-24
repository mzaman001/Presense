"use client";

import { removeTaskFromCaches, type TaskRecord } from "@/lib/task-cache";
import { useUserId } from "@/components/providers/SessionProvider";
import { use, useState, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  Play,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  MapPin,
  CalendarDays,
  Save,
  Zap,
} from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { useRealtime } from "@/hooks/useRealtime";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// INFRA-19: all status writes on entity tables go through item-lifecycle.ts
import { completeTaskPatch, uncompleteTaskPatch } from "@/lib/item-lifecycle";
import { COMPLETE_HOLD_MS } from "@/lib/constants";
import { useHaptics } from "@/hooks/useHaptics";
import { CheckTick } from "@/components/ui/CheckTick";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { CaptureShortcut } from "@/components/layout/CaptureShortcut";
import {
  fetchDashboardRows,
  summarizeDashboard,
  type DashboardRows,
} from "@/lib/dashboard";
import { PageSkeleton } from "@/components/ui/Skeleton";

/** Shared with Do and TaskCard — one generated shape, not a local copy. */
type TaskItem = TaskRecord;

/* @todo: Untyped usage justified per TOOL-01 */
function RitualStatusBadge({
  userSettings,
  streak,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userSettings: any;
  streak: number;
}) {
  const setActiveRitual = useAppStore((s) => s.setActiveRitual);
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA");
  const morningDone = userSettings?.last_ritual_date === todayStr;
  const eveningDone = userSettings?.last_evening_ritual_date === todayStr;
  const shutdownTime = userSettings?.shutdown_time || "17:00:00";
  const shutdownHour = shutdownTime.split(":")[0];
  const shutdownAmPm =
    parseInt(shutdownHour) >= 12
      ? `${parseInt(shutdownHour) === 12 ? 12 : parseInt(shutdownHour) - 12} PM`
      : `${parseInt(shutdownHour)} AM`;

  if (morningDone && eveningDone) {
    return (
      <div className="text-ui inline-flex items-center gap-1.5 font-medium text-[var(--status-done)]">
        <UiIcon className="h-3.5 w-3.5" icon={CheckCircle2} /> Day complete —
        Great work today
        {streak > 1 && (
          <span className="ml-1 opacity-80">· {streak}-day streak</span>
        )}
      </div>
    );
  }

  if (morningDone) {
    return (
      <div className="text-ui inline-flex items-center gap-1.5 text-[var(--text-3)]">
        <UiIcon
          className="h-3.5 w-3.5 text-[var(--accent)]"
          icon={CheckCircle2}
        />{" "}
        Day planned <span className="mx-1 opacity-50">•</span> Evening review at{" "}
        {shutdownAmPm}
        {streak > 1 && (
          <span className="ml-1 opacity-50">· {streak}-day streak</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setActiveRitual("morning")}
      className="text-ui group inline-flex min-h-9 items-center gap-1.5 text-left font-medium text-[var(--accent-text)] transition-colors hover:text-[var(--accent-hot)]"
    >
      <UiIcon className="h-3.5 w-3.5" icon={Sparkles} /> You haven&apos;t
      planned your day yet
      <UiIcon
        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
        icon={ArrowRight}
      />
    </button>
  );
}

const subscribeNoop = () => () => {};

/**
 * Reads the rows the server streamed on a cold load; a return visit renders
 * straight from the client cache. Split from HomeDashboard so the hooks
 * below never sit after a suspending use() (see DoView).
 */
export function HomeView({
  rowsPromise,
}: {
  rowsPromise: Promise<DashboardRows | null>;
}) {
  const queryClient = useQueryClient();
  const serverRows = queryClient.getQueryData<DashboardRows>(["dashboard"])
    ? undefined
    : (use(rowsPromise) ?? undefined);
  return <HomeDashboard serverRows={serverRows} />;
}

function HomeDashboard({
  serverRows,
}: {
  serverRows: DashboardRows | undefined;
}) {
  const userId = useUserId();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { userSettings, setActiveTimer } = useAppStore(
    useShallow((s) => ({
      userSettings: s.userSettings,
      setActiveTimer: s.setActiveTimer,
    })),
  );

  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [showReview, setShowReview] = useState(false);
  // FEAT-01 (Aug 17, 2026): optional weekly reflection, persisted
  // per week into a pinned "Weekly Note" thread — same storage
  // pattern as RitualOverlay's daily note.
  const [weeklyReflection, setWeeklyReflection] = useState("");
  const [completing, setCompleting] = useState<string | null>(null);
  const haptics = useHaptics();

  // Week, day and streak boundaries use the device's timezone, so Home is
  // first rendered with data after hydration, never on the server.
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboardRows(supabase, userId),
    initialData: serverRows,
  });
  const dashboardData = useMemo(
    () => (rows ? summarizeDashboard(rows, new Date()) : undefined),
    [rows],
  );
  const loading = !hydrated || rowsLoading;

  const {
    tasks = [],
    inboxItems = [],
    threads = [],
    doneTasks = [],
    pomodorosThisWeek = 0,
    doneTasksLastWeek = [],
    focusMinutesThisWeek = 0,
    focusMinutesLastWeek = 0,
    dayCounts = [],
    ritualStreak = 0,
    locationsCount = 0,
  } = dashboardData || {};

  // Same feel as the Do page: haptic + completion moment straight away, the
  // row leaves once it has played, and the write happens underneath. This
  // used to wait for the write and a nine-query dashboard refetch before
  // anything moved, with no haptic at all.
  const completeTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (completing) return;
    setCompleting(id);
    haptics.success();
    const removed: { rollback?: () => void } = {};
    const removal = setTimeout(() => {
      removed.rollback = removeTaskFromCaches(queryClient, id);
      setCompleting(null);
    }, COMPLETE_HOLD_MS);
    try {
      const { error } = await supabase
        .from("items")
        .update(completeTaskPatch())
        .eq("id", id);
      if (error) throw error;
      toast.success("Task completed", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const { error: undoError } = await supabase
              .from("items")
              .update(uncompleteTaskPatch())
              .eq("id", id);
            if (undoError) {
              toast.error("Couldn't restore the task");
              return;
            }
            void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            void queryClient.invalidateQueries({ queryKey: ["tasks"] });
          },
        },
      });
      void queryClient.invalidateQueries(
        { queryKey: ["dashboard"] },
        { cancelRefetch: false },
      );
    } catch {
      clearTimeout(removal);
      removed.rollback?.();
      setCompleting(null);
      haptics.error();
      toast.error("Failed to complete task");
    }
  };

  // FEAT-01: persist the week's reflection into a pinned thread,
  // matching RitualOverlay's daily-note pattern (threads entries array).
  const saveWeeklyReflection = async () => {
    const text = weeklyReflection.trim();
    if (!text) return;
    // Monday-start week label, e.g. "Aug 10 – Aug 16".
    const mon = new Date(mondayStartForLabel());
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const label = `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    const title = `Weekly Note: ${label}`;
    const { data: existing, error: selError } = await supabase
      .from("threads")
      .select("id, entries")
      .eq("title", title)
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);
    /* @todo: Untyped usage justified per TOOL-01 */

    if (selError) {
      toast.error("Failed to save reflection");
      return;
    }
    const entry: { text: string; created_at: string } = {
      text,
      created_at: new Date().toISOString(),
    };
    /* @todo: Untyped usage justified per TOOL-01 */

    let threadId: string | null = null;
    if (existing && existing.length > 0) {
      threadId = existing[0].id;
      const prev: { text: string; created_at: string }[] =
        (existing[0].entries as { text: string; created_at: string }[]) || [];
      if (prev.some((e) => e.text === text)) {
        toast.info("Reflection already saved for this week");
        setWeeklyReflection("");
        return;
      }
      const { error } = await supabase
        .from("threads")
        .update({
          entries: [...prev, entry],
          last_updated: new Date().toISOString(),
        })
        .eq("id", threadId);
      if (error) {
        toast.error("Failed to save reflection");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("threads")
        .insert({
          user_id: userId,
          title,
          color_accent: "#e3875f",
          is_pinned: true,
          entries: [entry],
        })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Failed to save reflection");
        return;
      }
      threadId = data.id;
    }
    toast.success("Weekly reflection saved");
    setWeeklyReflection("");
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // FEAT-01: the Monday start used by the reflection week label. Kept as a
  // pure helper that recomputes on every call so the label is always fresh.
  const mondayStartForLabel = () => {
    const now = new Date();
    const currentDay = now.getDay() || 7;
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - currentDay + 1,
      0,
      0,
      0,
      0,
    );
    return monday.getTime();
  };

  const refreshData = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  // Both tables already invalidate ["dashboard"] in useRealtime.
  useRealtime("items");
  useRealtime("threads");

  const primaryTask = tasks.length > 0 ? tasks[0] : null;

  if (loading) {
    return <PageSkeleton count={4} type="card" />;
  }

  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";

  let heroReason = "Earliest deadline";
  if (primaryTask) {
    if (
      primaryTask.deadline &&
      new Date(primaryTask.deadline).getTime() < new Date().getTime()
    ) {
      heroReason = `Overdue since ${new Date(primaryTask.deadline).toLocaleDateString()}`;
    } else if (primaryTask.priority === 1) {
      heroReason = "Highest priority";
    } else if (primaryTask.deadline) {
      const hours =
        (new Date(primaryTask.deadline).getTime() - new Date().getTime()) /
        3600000;
      if (hours < 3 && hours > 0)
        heroReason = `Due in ${Math.round(hours)} hours`;
      else
        heroReason = `Due ${new Date(primaryTask.deadline).toLocaleDateString()}`;
    }
  }

  // PWA2-01: the manifest "Quick Capture" shortcut navigates to /?capture=1,
  // which opens the capture modal directly from the installed app.
  return (
    <>
      <CaptureShortcut />
      <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-4xl space-y-6 duration-300">
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-page-greeting font-heading text-[var(--text-1)]">
              {greeting}
              <span className="text-[var(--text-3)]">
                {userSettings?.display_name
                  ? `, ${userSettings.display_name.split(" ")[0]}`
                  : ", you"}
                .
              </span>
            </h1>
            <RitualStatusBadge
              userSettings={userSettings}
              streak={ritualStreak}
            />
          </div>
          <button
            onClick={() => setShowReview(!showReview)}
            className={cn(
              "-ml-3 flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-lg px-3 text-[length:var(--text-ui)] font-medium whitespace-nowrap transition-colors sm:ml-0 sm:self-auto",
              showReview
                ? "text-[var(--color-text-1)]"
                : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]",
            )}
          >
            <UiIcon className="h-3.5 w-3.5" icon={CalendarDays} />
            {showReview ? "Back to Dashboard" : "Week in Review"}
          </button>
        </header>

        <ContextualTip
          id="home"
          title="Welcome"
          description="Focus now is always your most urgent task. Capture anything with + whenever it comes to mind."
        />

        {showReview ? (
          <div className="space-y-6">
            <GlassCard className="flex items-center gap-3 p-4">
              <UiIcon
                className="h-4 w-4 text-[var(--accent)]"
                icon={CalendarDays}
              />
              <div className="text-sm font-medium text-[var(--color-text-1)]">
                {(() => {
                  const mon = new Date(mondayStartForLabel());
                  const sun = new Date(mon);
                  sun.setDate(sun.getDate() + 6);
                  return `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
                })()}
                <span className="ml-2 font-normal text-[var(--color-text-3)]">
                  Week in Review
                </span>
              </div>
            </GlassCard>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* FEAT-01: this vs last week, neutral tone — a dip is
                  information, never a rebuke. */}
              <GlassCard className="p-5">
                <div className="text-xs tracking-wider text-[var(--color-text-3)] uppercase">
                  Tasks Completed
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-light text-[var(--color-text-1)]">
                    {doneTasks.length}
                  </span>
                  <span className="text-xs text-[var(--color-text-3)]">
                    {doneTasks.length > doneTasksLastWeek.length
                      ? `${doneTasks.length - doneTasksLastWeek.length} more than last week`
                      : doneTasks.length < doneTasksLastWeek.length
                        ? `${doneTasksLastWeek.length - doneTasks.length} fewer than last week`
                        : "same as last week"}
                  </span>
                </div>
              </GlassCard>
              <GlassCard className="p-5">
                <div className="text-xs tracking-wider text-[var(--color-text-3)] uppercase">
                  Focus Time
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-light text-[var(--color-text-1)]">
                    {Math.floor(focusMinutesThisWeek / 60)}h{" "}
                    {focusMinutesThisWeek % 60}m
                  </span>
                  <span className="text-xs text-[var(--color-text-3)]">
                    {focusMinutesThisWeek > focusMinutesLastWeek
                      ? `${focusMinutesThisWeek - focusMinutesLastWeek} min more than last week`
                      : focusMinutesThisWeek < focusMinutesLastWeek
                        ? `${focusMinutesLastWeek - focusMinutesThisWeek} min fewer than last week`
                        : "same as last week"}
                  </span>
                </div>
              </GlassCard>
            </div>
            <GlassCard className="p-5">
              <div className="mb-3 text-xs tracking-wider text-[var(--color-text-3)] uppercase">
                When you got things done
              </div>
              <div className="flex items-end gap-1.5">
                {dayCounts.map((count, i) => {
                  const labels = [
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                    "Sun",
                  ];
                  const max = Math.max(1, ...dayCounts);
                  const h = Math.max(4, Math.round((count / max) * 56));
                  return (
                    <div
                      key={labels[i]}
                      className="flex flex-1 flex-col items-center gap-1.5"
                    >
                      <div
                        className="w-full rounded-sm bg-[var(--accent)]/25"
                        style={{ height: count > 0 ? h : 4 }}
                      />
                      <span className="text-caption text-[var(--text-3)]">
                        {labels[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
              {doneTasks.length === 0 && (
                <p className="mt-3 text-xs text-[var(--color-text-3)]">
                  No completions this week yet — data appears here as tasks are
                  finished.
                </p>
              )}
            </GlassCard>
            <GlassCard className="p-5">
              <div className="mb-3 text-xs tracking-wider text-[var(--color-text-3)] uppercase">
                Reflection{" "}
                <span className="font-normal tracking-normal normal-case">
                  (optional — write if you want to)
                </span>
              </div>
              <textarea
                value={weeklyReflection}
                onChange={(e) => setWeeklyReflection(e.target.value)}
                placeholder="What went well this week? What would you like to change?"
                rows={3}
                className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:border-[var(--accent)]/50 focus:outline-none"
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={saveWeeklyReflection}
                  disabled={!weeklyReflection.trim()}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    weeklyReflection.trim()
                      ? "bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25"
                      : "cursor-not-allowed text-[var(--color-text-3)]/50",
                  )}
                >
                  <UiIcon className="h-3.5 w-3.5" icon={Save} /> Save reflection
                </button>
              </div>
            </GlassCard>
            <h2 className="mb-4 text-xl font-semibold text-[var(--color-text-1)]">
              Completed This Week
            </h2>
            {doneTasks.length === 0 ? (
              <GlassCard className="border-dashed p-8 text-center text-[var(--color-text-3)]">
                No tasks completed in the last 7 days.
              </GlassCard>
            ) : (
              /* @todo: Untyped usage justified per TOOL-01 */
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              doneTasks.map((task: any) => (
                <GlassCard
                  key={task.id}
                  className="flex items-center justify-between p-4 opacity-80"
                >
                  <div>
                    <h4 className="text-card-title text-[var(--text-1)] line-through">
                      {task.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-[var(--color-text-3)]">
                      Completed{" "}
                      {task.completed_at
                        ? new Date(task.completed_at).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                  <UiIcon
                    className="h-5 w-5 text-[var(--color-do)]"
                    icon={CheckCircle2}
                  />
                </GlassCard>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Inbox banner removed, using Inbox Section below Up Next instead */}

            {/* Focus Now Hero Card */}
            {primaryTask ? (
              <GlassCard
                variant="hero"
                className="relative overflow-hidden p-5 sm:p-8"
              >
                <div className="relative z-10 flex h-full flex-col items-center justify-center px-1 py-6 text-center sm:p-10">
                  <span className="text-label mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-dim)] px-3 py-1.5 text-[var(--accent-text)]">
                    <Zap
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={2}
                    />
                    Focus now
                  </span>
                  <h2 className="font-heading mb-1 text-[length:var(--text-title-3xl)] leading-tight font-medium text-balance text-[var(--text-1)]">
                    {primaryTask.title}
                  </h2>
                  <p className="text-label mb-4 text-[var(--text-3)]">
                    {heroReason}
                  </p>
                  <p className="mb-6 text-lg text-[var(--text-2)]">
                    {primaryTask.first_step}
                  </p>

                  <Button
                    variant="primary"
                    onClick={() =>
                      setActiveTimer({
                        taskId: primaryTask.id,
                        taskTitle: primaryTask.title,
                      })
                    }
                    className=""
                  >
                    <UiIcon
                      className="h-4 w-4 fill-[currentColor]"
                      icon={Play}
                    />
                    <span>Start session</span>
                  </Button>
                  <button
                    onClick={async () => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);

                      const snoozedTask = primaryTask;

                      // Save current states for rollback
                      const previousDashboard = queryClient.getQueryData([
                        "dashboard",
                      ]);
                      const previousTasks = queryClient.getQueryData(["tasks"]);

                      // Optimistic UI updates
                      /* @todo: Untyped usage justified per TOOL-01 */
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      queryClient.setQueryData(["dashboard"], (old: any) => {
                        if (!old) return old;
                        return {
                          ...old,
                          /* @todo: Untyped usage justified per TOOL-01 */
                          tasks: old.tasks.filter(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (t: any) => t.id !== snoozedTask.id,
                          ),
                        };
                      });
                      /* @todo: Untyped usage justified per TOOL-01 */
                      queryClient.setQueryData(
                        ["tasks"],
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (old: any[] | undefined) =>
                          old?.filter((t) => t.id !== snoozedTask.id) ?? [],
                      );

                      try {
                        useAppStore.getState().markMutation();
                        const { error } = await supabase
                          .from("items")
                          .update({ snoozed_until: tomorrow.toISOString() })
                          .eq("id", snoozedTask.id);
                        if (error) throw error;

                        queryClient.invalidateQueries({
                          queryKey: ["dashboard"],
                        });
                        queryClient.invalidateQueries({ queryKey: ["tasks"] });

                        toast.success("Snoozed until tomorrow", {
                          duration: 8000,
                          action: {
                            label: "Undo",
                            onClick: async () => {
                              const currentDashboard = queryClient.getQueryData(
                                ["dashboard"],
                              );
                              const currentTasks = queryClient.getQueryData([
                                "tasks",
                              ]);

                              // Optimistic restore (put task back)
                              /* @todo: Untyped usage justified per TOOL-01 */
                              queryClient.setQueryData(
                                ["dashboard"],
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (old: any) => {
                                  if (!old) return old;
                                  return {
                                    ...old,
                                    tasks: [
                                      ...old.tasks,
                                      { ...snoozedTask, snoozed_until: null },
                                    ],
                                  };
                                },
                              );
                              /* @todo: Untyped usage justified per TOOL-01 */
                              queryClient.setQueryData(
                                ["tasks"],
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (old: any[] | undefined) =>
                                  old
                                    ? [
                                        ...old,
                                        { ...snoozedTask, snoozed_until: null },
                                      ]
                                    : [],
                              );

                              try {
                                useAppStore.getState().markMutation();
                                const { error: undoError } = await supabase
                                  .from("items")
                                  .update({ snoozed_until: null })
                                  .eq("id", snoozedTask.id);
                                if (undoError) throw undoError;

                                queryClient.invalidateQueries({
                                  queryKey: ["dashboard"],
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ["tasks"],
                                });
                                toast.success("Snooze reversed");
                              } catch {
                                // Rollback undo
                                queryClient.setQueryData(
                                  ["dashboard"],
                                  currentDashboard,
                                );
                                queryClient.setQueryData(
                                  ["tasks"],
                                  currentTasks,
                                );
                                toast.error("Failed to undo snooze");
                              }
                            },
                          },
                        });
                      } catch {
                        // Rollback snooze
                        queryClient.setQueryData(
                          ["dashboard"],
                          previousDashboard,
                        );
                        queryClient.setQueryData(["tasks"], previousTasks);
                        toast.error("Failed to snooze task");
                      }
                    }}
                    className="mt-4 text-xs text-[var(--text-3)] underline decoration-dashed underline-offset-4 transition-colors hover:text-[var(--text-1)]"
                  >
                    Snooze until tomorrow
                  </button>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="font-heading p-10 text-center text-[length:var(--text-title-xl)] text-[var(--text-2)]">
                No active tasks. Take a breath.
              </GlassCard>
            )}

            {/* Bento 4-card overview — deliberately the lightest-weight row on
                the page: small counters, muted (non-accent) icon tone, and
                tight padding, so they read as minor context rather than
                competing with the hero or the weekly-effort row below. */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                {
                  href: "/do",
                  icon: CheckCircle2,
                  value: tasks.length,
                  label: "Active Tasks",
                },
                {
                  href: null,
                  icon: Sparkles,
                  value: ritualStreak,
                  label: "Day Streak",
                },
                {
                  href: "/think",
                  icon: MessageSquare,
                  value: threads.length,
                  label: "Open Threads",
                },
                {
                  href: "/remember/locations",
                  icon: MapPin,
                  value: locationsCount,
                  label: "Locations",
                },
              ].map((tile, i) => {
                const card = (
                  <GlassCard
                    hoverable={!!tile.href}
                    className="flex h-full flex-col justify-between p-4"
                  >
                    <UiIcon
                      size={16}
                      strokeWidth={1.5}
                      className="mb-3 shrink-0 text-[var(--color-text-3)]"
                      icon={tile.icon}
                    />
                    <div>
                      <div className="font-heading text-[length:var(--text-title-2xl)] leading-none text-[var(--text-1)] tabular-nums">
                        <AnimatedNumber value={tile.value} />
                      </div>
                      <div className="text-meta mt-1.5 text-[var(--text-3)]">
                        {tile.label}
                      </div>
                    </div>
                  </GlassCard>
                );
                return (
                  <m.div
                    key={tile.label}
                    className="h-full"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.05,
                      duration: 0.2,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    {tile.href ? (
                      <Link href={tile.href} className="block h-full">
                        {card}
                      </Link>
                    ) : (
                      card
                    )}
                  </m.div>
                );
              })}
            </div>

            {/* Weekly-effort summary — real secondary weight: bigger type
                and an accent-tinted number, one visible step down from the
                hero but clearly above the bento row's minor counters. */}
            <m.div
              className="mt-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.2,
                duration: 0.24,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <GlassCard className="grid grid-cols-2 divide-x divide-[var(--border-subtle)] p-0">
                {[
                  { label: "Focus sessions", value: pomodorosThisWeek },
                  { label: "Tasks finished", value: doneTasks.length },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-1.5 p-5">
                    <span className="text-label text-[var(--text-3)]">
                      This week
                    </span>
                    <span className="font-heading text-[length:var(--text-title-3xl)] leading-none text-[var(--accent-text)] tabular-nums">
                      <AnimatedNumber value={stat.value} />
                    </span>
                    <span className="text-body text-[var(--text-2)]">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </GlassCard>
            </m.div>

            {userSettings?.daily_briefing !== false && (
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Today's Tasks */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-section-title text-[var(--text-1)]">
                      Up Next
                    </h3>
                    <Link
                      href="/do"
                      className="flex items-center gap-1 text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
                    >
                      {tasks.length > 1
                        ? `${Math.min(5, tasks.length - 1)} of ${tasks.length - 1} tasks shown — `
                        : ""}
                      View all <UiIcon className="h-3 w-3" icon={ArrowRight} />
                    </Link>
                  </div>
                  <AnimatePresence initial={false} mode="popLayout">
                    {tasks.slice(1, 6).map((task, i) => (
                      <m.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          scale: 0.97,
                          x: -16,
                          transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
                        }}
                        transition={{
                          delay: i * 0.05,
                          duration: 0.2,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                      >
                        <GlassCard
                          hoverable
                          className="flex items-start justify-between gap-3 p-4"
                          onClick={() => {
                            setTaskToEdit(task);
                            setIsTaskPanelOpen(true);
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => completeTask(e, task.id)}
                            aria-label={`Complete ${task.title}`}
                            aria-pressed={completing === task.id}
                            className={cn(
                              "checkbox mt-0.5",
                              completing === task.id && "checked",
                            )}
                          >
                            {completing === task.id && (
                              <CheckTick className="h-3.5 w-3.5 text-[var(--text-on-accent)]" />
                            )}
                          </button>
                          <div
                            className={cn(
                              "min-w-0 flex-1",
                              completing === task.id && "is-done",
                            )}
                          >
                            <h4 className="text-card-title text-[var(--text-1)]">
                              <span className="task-title-strike">
                                {task.title}
                              </span>
                            </h4>
                            <p className="mt-0.5 truncate text-xs text-[var(--color-text-3)]">
                              {task.first_step}
                            </p>
                          </div>
                          <UiIcon
                            className="mt-1 ml-2 h-4 w-4 shrink-0 text-[var(--color-text-3)]"
                            icon={ArrowRight}
                          />
                        </GlassCard>
                      </m.div>
                    ))}
                  </AnimatePresence>
                  {tasks.length <= 1 && (
                    <div className="rounded-2xl border border-[var(--border-subtle)] p-5 text-center text-[length:var(--text-body)] text-[var(--text-3)]">
                      Nothing else waiting. Enjoy the quiet.
                    </div>
                  )}
                </div>

                {/* Inbox Section */}
                {inboxItems.length > 0 && (
                  <div className="space-y-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-section-title text-[var(--text-1)]">
                          Inbox
                        </h3>
                        <div className="text-meta rounded-full bg-[var(--accent-dim)] px-2 py-0.5 font-medium text-[var(--accent-text)] tabular-nums">
                          {inboxItems.length} new
                        </div>
                      </div>
                      <Link
                        href="/inbox"
                        className="flex items-center gap-1 text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
                      >
                        View all{" "}
                        <UiIcon className="h-3 w-3" icon={ArrowRight} />
                      </Link>
                    </div>
                    <p className="text-sm text-[var(--color-text-3)]">
                      Items waiting to be sorted.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <TaskAddPanel
          isOpen={isTaskPanelOpen}
          onClose={() => {
            setIsTaskPanelOpen(false);
            setTimeout(() => setTaskToEdit(null), 300);
          }}
          onTaskAdded={refreshData}
          taskToEdit={taskToEdit}
        />
      </div>
    </>
  );
}
