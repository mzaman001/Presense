"use client";

import type { TaskRecord } from "@/lib/task-cache";
import { useUserId } from "@/components/providers/SessionProvider";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  Play,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Loader2,
  Check,
  Sparkles,
  MapPin,
  CalendarDays,
  Save,
} from "lucide-react";
import { m } from "framer-motion";
import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { useRealtime } from "@/hooks/useRealtime";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// INFRA-19: all status writes on entity tables go through item-lifecycle.ts
import { completeTaskPatch } from "@/lib/item-lifecycle";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { CaptureShortcut } from "@/components/layout/CaptureShortcut";
import { computeRitualStreak } from "@/lib/ritualStreak";

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
      className="text-ui group inline-flex items-center gap-1.5 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hot)]"
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

export default function HomeDashboard() {
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

  const { data: dashboardData, isLoading: loading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date();
      const currentDay = now.getDay() || 7;
      const mondayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - currentDay + 1,
        0,
        0,
        0,
        0,
      );
      // FEAT-01 (Aug 17, 2026): last week's Monday for the this-vs-last-week
      // comparison in the Week in Review surface.
      const lastMondayStart = new Date(mondayStart);
      lastMondayStart.setDate(lastMondayStart.getDate() - 7);

      const [
        tasksRes,
        inboxRes,
        threadsRes,
        doneRes,
        sessionsRes,
        doneLastWeekRes,
        sessionsLastWeekRes,
        ritualLogsRes,
        locationsCountRes,
      ] = await Promise.all([
        // INFRA-18: explicit user_id filter for planner index usage
        supabase
          .from("items")
          .select("*")
          .eq("user_id", userId)
          .in("status", ["active", "overdue"])
          .range(0, 99),
        supabase
          .from("items")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "inbox")
          .range(0, 99),
        supabase.from("threads").select("*").eq("user_id", userId).range(0, 99),
        supabase
          .from("items")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "done")
          .gte("completed_at", mondayStart.toISOString())
          .order("completed_at", { ascending: false })
          .range(0, 99),
        supabase
          .from("session_logs")
          .select("*")
          .eq("user_id", userId)
          .gte("completed_at", mondayStart.toISOString())
          .eq("type", "work")
          .range(0, 99),
        // FEAT-01: last week's completions and focus sessions.
        supabase
          .from("items")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "done")
          .gte("completed_at", lastMondayStart.toISOString())
          .lt("completed_at", mondayStart.toISOString())
          .range(0, 99),
        supabase
          .from("session_logs")
          .select("duration_minutes")
          .eq("user_id", userId)
          .gte("completed_at", lastMondayStart.toISOString())
          .eq("type", "work")
          .range(0, 99),
        // Ritual streak: last 60 days of morning completions is enough
        // slack for any real streak while keeping the query cheap.
        supabase
          .from("ritual_logs")
          .select("completed_at")
          .eq("user_id", userId)
          .eq("ritual_type", "morning")
          .gte(
            "completed_at",
            new Date(now.getTime() - 60 * 86400000).toISOString(),
          )
          .range(0, 199),
        // count-only: the bento tile needs a number, not the rows.
        supabase
          .from("locations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
      ]);

      let upNext: TaskItem[] = [];
      if (tasksRes.data) {
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ).getTime();

        const sorted = tasksRes.data.sort((a, b) => {
          const aPrio = a.priority ?? 4;
          const bPrio = b.priority ?? 4;

          const aOverdue = a.deadline && new Date(a.deadline) < now;
          const bOverdue = b.deadline && new Date(b.deadline) < now;
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;

          const aToday =
            a.deadline &&
            new Date(a.deadline).getTime() >= todayStart &&
            new Date(a.deadline).getTime() < todayStart + 86400000;
          const bToday =
            b.deadline &&
            new Date(b.deadline).getTime() >= todayStart &&
            new Date(b.deadline).getTime() < todayStart + 86400000;

          if (aPrio === 1 && bPrio !== 1) return -1;
          if (bPrio === 1 && aPrio !== 1) return 1;

          if (aToday && aPrio === 2 && (!bToday || bPrio !== 2)) return -1;
          if (bToday && bPrio === 2 && (!aToday || aPrio !== 2)) return 1;

          if (a.deadline && b.deadline)
            return (
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
            );
          if (a.deadline) return -1;
          if (b.deadline) return 1;

          return aPrio - bPrio;
        });
        upNext = sorted.filter(
          (t) => !t.snoozed_until || new Date(t.snoozed_until) <= now,
        ) as unknown as TaskItem[];
      }

      // FEAT-01: fixed set of review metrics derived from existing
      // timestamps — no new tracking infrastructure.
      const sessionsThisWeek = sessionsRes.data || [];
      const sessionsLastWeek = sessionsLastWeekRes.data || [];
      const focusMinutesThisWeek = sessionsThisWeek.reduce(
        (sum, s) => sum + (Number(s.duration_minutes) || 0),
        0,
      );
      const focusMinutesLastWeek = sessionsLastWeek.reduce(
        (sum, s) => sum + (Number(s.duration_minutes) || 0),
        0,
      );
      const doneTasksLastWeek = doneLastWeekRes.data || [];
      // FEAT-01: day-of-week completion pattern, Monday-indexed (0 = Mon …
      // 6 = Sun) to match this page's mondayStart week convention.
      const dayCounts = new Array(7).fill(0) as number[];
      for (const task of doneRes.data || []) {
        if (!task.completed_at) continue;
        const day = (new Date(task.completed_at).getDay() + 6) % 7;
        if (day >= 0 && day <= 6) dayCounts[day]++;
      }
      const ritualDateKeys = (ritualLogsRes.data || []).map((row) =>
        new Date(row.completed_at).toLocaleDateString("en-CA"),
      );
      const ritualStreak = computeRitualStreak(ritualDateKeys, now);
      return {
        tasks: upNext,
        inboxItems: inboxRes.data || [],
        threads: threadsRes.data || [],
        doneTasks: doneRes.data || [],
        pomodorosThisWeek: sessionsThisWeek.length,
        doneTasksLastWeek,
        focusMinutesThisWeek,
        focusMinutesLastWeek,
        dayCounts,
        ritualStreak,
        locationsCount: locationsCountRes.count || 0,
      };
    },
  });

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

  const completeTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCompleting(id);
    try {
      const { error } = await supabase
        .from("items")
        .update(completeTaskPatch())
        .eq("id", id);
      if (error) throw error;
      toast.success("Task completed");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("Failed to complete task");
    } finally {
      setCompleting(null);
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
          color_accent: "#d97757",
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

  useRealtime("items", refreshData);
  useRealtime("threads", refreshData);

  const primaryTask = tasks.length > 0 ? tasks[0] : null;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <UiIcon
          className="h-8 w-8 animate-spin text-[var(--color-text-3)]"
          icon={Loader2}
        />
      </div>
    );
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
      <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-4xl space-y-6 duration-500">
        <header className="mb-8 flex items-end justify-between">
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
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
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
          title="Welcome to your External Brain"
          description="This is your dashboard. The 'Focus Now' task is chosen based on the most urgent deadline. Use the '+' button below anytime to capture new things."
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
                      <span className="text-[10px] text-[var(--color-text-3)]">
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
                className="relative overflow-hidden p-8"
              >
                <div
                  aria-hidden="true"
                  className="absolute top-8 right-8 h-24 w-24 rounded-full border-2 border-[var(--accent-border)]"
                />

                <div className="relative z-10 flex h-full flex-col items-center justify-center p-10 text-center">
                  <span className="text-caption mb-4 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 font-bold tracking-widest text-[var(--accent)] uppercase">
                    ⚡ FOCUS NOW
                  </span>
                  <h2 className="mb-1 text-3xl font-medium text-[var(--text-1)]">
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
                    <span>Start session &rarr;</span>
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
              <GlassCard className="border-dashed p-8 text-center text-[var(--color-text-3)]">
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
                      <div className="text-lg font-light text-[var(--color-text-2)]">
                        <AnimatedNumber value={tile.value} />
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--color-text-3)]">
                        {tile.label}
                      </div>
                    </div>
                  </GlassCard>
                );
                return (
                  <m.div
                    key={tile.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.05,
                      duration: 0.2,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    {tile.href ? (
                      <Link href={tile.href} className="block">
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
            <div className="mt-6 flex flex-col items-center gap-4 md:flex-row">
              {[
                { label: "Pomodoros this week", value: pomodorosThisWeek },
                {
                  label: "Tasks completed this week",
                  value: doneTasks.length,
                },
              ].map((stat, i) => (
                <m.div
                  key={stat.label}
                  className="w-full flex-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: (4 + i) * 0.05,
                    duration: 0.2,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <GlassCard className="flex w-full items-center justify-between p-5">
                    <span className="text-card-title tracking-wider text-[var(--color-text-2)] uppercase">
                      {stat.label}
                    </span>
                    <span className="text-3xl font-semibold text-[var(--accent)]">
                      <AnimatedNumber value={stat.value} />
                    </span>
                  </GlassCard>
                </m.div>
              ))}
            </div>

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
                  {tasks.slice(1, 6).map((task, i) => (
                    <m.div
                      key={task.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
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
                          onClick={(e) => completeTask(e, task.id)}
                          className={cn(
                            "checkbox mt-0.5",
                            completing === task.id && "checked",
                          )}
                        >
                          {completing === task.id && (
                            <UiIcon
                              className="h-3.5 w-3.5 text-white"
                              icon={Check}
                            />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-card-title text-[var(--text-1)]">
                            {task.title}
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
                  {tasks.length <= 1 && (
                    <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-3)]">
                      All caught up!
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
                        <div className="text-caption rounded-full bg-[var(--accent-dim)] px-2 py-0.5 font-bold tracking-wider text-[var(--accent)]">
                          {inboxItems.length} NEW
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
