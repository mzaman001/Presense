"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, safeMutate } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  Play,
  ArrowRight,
  CheckCircle2,
  Users,
  MessageSquare,
  Compass,
  Loader2,
  FolderInput,
  X,
  Check,
  Sparkles,
  Brain,
  MapPin,
} from "lucide-react";
import { m } from "framer-motion";
import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { useRealtime } from "@/hooks/useRealtime";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { CaptureShortcut } from "@/components/layout/CaptureShortcut";

interface TaskItem {
  id: string;
  title: string;
  priority: number | null;
  deadline: string | null;
  first_step: string | null;
  status: string;
  snoozed_until: string | null;
  completed_at: string | null;
  category: string | null;
  user_id: string;
}

/* @todo: Untyped usage justified per TOOL-01 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RitualStatusBadge({ userSettings }: { userSettings: any }) {
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
      <div className="text-ui mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--status-done)]/20 bg-[var(--status-done)]/10 px-3 py-1 font-medium text-[var(--status-done)]">
        <UiIcon className="h-3.5 w-3.5" icon={CheckCircle2} /> Day complete —
        Great work today
      </div>
    );
  }

  if (morningDone) {
    return (
      <div className="text-ui mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-dim)]/10 px-3 py-1 font-medium text-[var(--text-3)]">
        <UiIcon
          className="h-3.5 w-3.5 text-[var(--accent)]"
          icon={CheckCircle2}
        />{" "}
        Day planned <span className="mx-1 opacity-50">•</span> Evening review at{" "}
        {shutdownAmPm}
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={() => setActiveRitual("morning")}
        className="text-ui group inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
      >
        <UiIcon className="h-3.5 w-3.5" icon={Sparkles} /> You haven&apos;t
        planned your day yet
        <UiIcon
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          icon={ArrowRight}
        />
      </button>
    </div>
  );
}

export default function HomeDashboard() {
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
  const [completing, setCompleting] = useState<string | null>(null);
  const [activeRouteItem, setActiveRouteItem] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".dropdown-trigger")) return;
      setActiveRouteItem(null);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const { data: dashboardData, isLoading: loading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

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

      const [
        tasksRes,
        inboxRes,
        peopleRes,
        threadsRes,
        exploresRes,
        doneRes,
        sessionsRes,
      ] = await Promise.all([
        // INFRA-18: explicit user_id filter for planner index usage
        supabase
          .from("items")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["active", "overdue"])
          .range(0, 99),
        supabase.from("items").select("*").eq("user_id", user.id).eq("status", "inbox").range(0, 99),
        supabase.from("people").select("*").eq("user_id", user.id).range(0, 99),
        supabase.from("threads").select("*").eq("user_id", user.id).range(0, 99),
        supabase
          .from("explores")
          .select("*")
          .eq("user_id", user.id)
          .is("revisited_at", null)
          .range(0, 99),
        supabase
          .from("items")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "done")
          .gte("completed_at", mondayStart.toISOString())
          .order("completed_at", { ascending: false })
          .range(0, 99),
        supabase
          .from("session_logs")
          .select("*")
          .eq("user_id", user.id)
          .gte("completed_at", mondayStart.toISOString())
          .eq("type", "work")
          .range(0, 99),
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

      return {
        tasks: upNext,
        inboxItems: inboxRes.data || [],
        people: peopleRes.data || [],
        threads: threadsRes.data || [],
        explores: exploresRes.data || [],
        doneTasks: doneRes.data || [],
        pomodorosThisWeek: sessionsRes.data ? sessionsRes.data.length : 0,
      };
    },
  });

  const {
    tasks = [],
    inboxItems = [],
    people = [],
    threads = [],
    explores = [],
    doneTasks = [],
    pomodorosThisWeek = 0,
  } = dashboardData || {};

  const completeTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCompleting(id);
    try {
      const { error } = await supabase
        .from("items")
        .update({ status: "done", completed_at: new Date().toISOString() })
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

  const routeInboxItem = async (id: string, space: string) => {
    if (!space) return;
    try {
      if (space === "do") {
        const { success } = await safeMutate(
          () =>
            supabase.from("items").update({ status: "active" }).eq("id", id),
          "Failed to route to Do",
        );
        if (!success) return;
      } else if (space === "explore") {
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = inboxItems.find((i: any) => i.id === id);
        if (!item) return;
        const { success } = await safeMutate(
          () =>
            supabase.from("explores").insert({
              user_id: item.user_id,
              title: item.title,
              type: "other",
              status: "active",
            }),
          "Failed to route to Explore",
        );
        if (!success) return;
        const { success: removed } = await safeMutate(
          () => supabase.from("items").delete().eq("id", id),
          "Routed, but failed to remove from Inbox",
        );
        if (!removed) return;
      } else if (space === "think") {
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = inboxItems.find((i: any) => i.id === id);
        if (!item) return;
        const { success } = await safeMutate(
          () =>
            supabase.from("threads").insert({
              user_id: item.user_id,
              title: item.title,
              status: "active",
              color_accent: "#2DD4BF",
            }),
          "Failed to route to Think",
        );
        if (!success) return;
        const { success: removed } = await safeMutate(
          () => supabase.from("items").delete().eq("id", id),
          "Routed, but failed to remove from Inbox",
        );
        if (!removed) return;
      }
      toast.success(`Routed to ${space}`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("Failed to route item");
    }
  };

  const dismissInboxItem = async (id: string) => {
    try {
      const { success } = await safeMutate(
        () => supabase.from("items").update({ status: "deleted" }).eq("id", id),
        "Failed to dismiss",
      );
      if (!success) return;
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("Failed to dismiss");
    }
  };

  const refreshData = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  useRealtime("items", refreshData);
  useRealtime("people", refreshData);
  useRealtime("threads", refreshData);
  useRealtime("explores", refreshData);

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
          <div>
            <h1 className="text-page-greeting text-[var(--text-1)]">
              {greeting}
              <span className="text-[var(--text-3)]">
                {userSettings?.display_name
                  ? `, ${userSettings.display_name.split(" ")[0]}`
                  : ", you"}
                .
              </span>
            </h1>
            <RitualStatusBadge userSettings={userSettings} />
          </div>
          <button
            onClick={() => setShowReview(!showReview)}
            className={cn(
              "rounded-xl border px-4 py-2 text-xs font-medium transition-colors",
              showReview
                ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] text-[var(--color-background)]"
                : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]",
            )}
          >
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
            <div className="mb-6 grid grid-cols-2 gap-4">
              <GlassCard className="flex flex-col items-center justify-center p-6 text-center">
                <div className="mb-1 text-3xl font-light text-[var(--color-text-1)]">
                  {doneTasks.length}
                </div>
                <div className="text-xs text-[var(--color-text-3)]">
                  Tasks Completed
                </div>
              </GlassCard>
              <GlassCard className="flex flex-col items-center justify-center p-6 text-center">
                <div className="mb-1 text-3xl font-light text-[var(--color-text-1)]">
                  {pomodorosThisWeek}
                </div>
                <div className="text-xs text-[var(--color-text-3)]">
                  Focus Sessions
                </div>
              </GlassCard>
            </div>
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
              <GlassCard className="relative overflow-hidden p-8">
                <div className="absolute top-0 right-0 p-8">
                  <div
                    className="animate-spin-slow relative h-24 w-24 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, var(--accent), var(--accent-hot), var(--accent-deep), var(--accent))",
                      filter: "blur(1px)",
                      WebkitMaskImage:
                        "radial-gradient(circle, transparent 40px, black 41px)",
                      maskImage:
                        "radial-gradient(circle, transparent 40px, black 41px)",
                    }}
                  />
                </div>

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

            {/* Bento 4-card overview */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link href="/do" className="block">
                <GlassCard
                  hoverable
                  className="flex h-full flex-col justify-between"
                >
                  <UiIcon
                    size={20}
                    strokeWidth={1.5}
                    className="mb-4 shrink-0 text-[var(--color-do)]"
                    icon={CheckCircle2}
                  />
                  <div>
                    <div className="text-2xl font-light text-[var(--color-text-1)]">
                      <AnimatedNumber value={tasks.length} />
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-3)]">
                      Active Tasks
                    </div>
                  </div>
                </GlassCard>
              </Link>
              <Link href="/remember/people" className="block">
                <GlassCard
                  hoverable
                  className="flex h-full flex-col justify-between"
                >
                  <UiIcon
                    size={20}
                    strokeWidth={1.5}
                    className="mb-4 shrink-0 text-[var(--color-people)]"
                    icon={Users}
                  />
                  <div>
                    <div className="text-2xl font-light text-[var(--color-text-1)]">
                      <AnimatedNumber value={people.length} />
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-3)]">
                      People Tracked
                    </div>
                  </div>
                </GlassCard>
              </Link>
              <Link href="/think" className="block">
                <GlassCard
                  hoverable
                  className="flex h-full flex-col justify-between"
                >
                  <UiIcon
                    size={20}
                    strokeWidth={1.5}
                    className="mb-4 shrink-0 text-[var(--color-think)]"
                    icon={MessageSquare}
                  />
                  <div>
                    <div className="text-2xl font-light text-[var(--color-text-1)]">
                      <AnimatedNumber value={threads.length} />
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-3)]">
                      Open Threads
                    </div>
                  </div>
                </GlassCard>
              </Link>
              <Link href="/explore" className="block">
                <GlassCard
                  hoverable
                  className="flex h-full flex-col justify-between"
                >
                  <UiIcon
                    size={20}
                    strokeWidth={1.5}
                    className="mb-4 shrink-0 text-[var(--color-explore)]"
                    icon={Compass}
                  />
                  <div>
                    <div className="text-2xl font-light text-[var(--color-text-1)]">
                      <AnimatedNumber value={explores.length} />
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-3)]">
                      Saved Items
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </div>

            <div className="mt-6 flex flex-col items-center gap-4 md:flex-row">
              <GlassCard className="flex w-full flex-1 items-center justify-between p-5">
                <span className="text-card-title tracking-wider text-[var(--color-text-3)] uppercase">
                  Pomodoros this week
                </span>
                <span className="text-2xl font-semibold text-[var(--color-text-1)]">
                  <AnimatedNumber value={pomodorosThisWeek} />
                </span>
              </GlassCard>
              <GlassCard className="flex w-full flex-1 items-center justify-between p-5">
                <span className="text-card-title tracking-wider text-[var(--color-text-3)] uppercase">
                  Tasks completed this week
                </span>
                <span className="text-2xl font-semibold text-[var(--color-text-1)]">
                  <AnimatedNumber value={doneTasks.length} />
                </span>
              </GlassCard>
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
                        className="flex cursor-pointer items-start justify-between gap-3 p-4 transition-transform hover:scale-[1.01]"
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
                        <div className="text-caption rounded-full bg-amber-500/20 px-2 py-0.5 font-bold tracking-wider text-amber-500">
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
                    {/* @todo: Untyped usage justified per TOOL-01 */}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {inboxItems.map((item: any) => (
                      <GlassCard
                        key={item.id}
                        className="group flex flex-col items-start justify-between gap-4 border-amber-500/20 bg-amber-500/5 p-4 md:flex-row md:items-center"
                      >
                        <p className="text-card-title flex-1 text-[var(--text-1)]">
                          {item.title}
                        </p>
                        <div className="flex w-full shrink-0 items-center gap-2 opacity-100 transition-opacity md:w-auto md:opacity-0 md:group-hover:opacity-100">
                          <div className="relative flex-1 md:flex-none">
                            <Button
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (
                                  e.currentTarget as HTMLElement
                                ).getBoundingClientRect();
                                setDropdownRect(rect);
                                setActiveRouteItem(
                                  activeRouteItem === item.id ? null : item.id,
                                );
                              }}
                              className="dropdown-trigger w-full"
                            >
                              <UiIcon
                                className="h-3.5 w-3.5"
                                icon={FolderInput}
                              />
                              Route it
                            </Button>
                            {activeRouteItem === item.id &&
                              dropdownRect &&
                              createPortal(
                                <div
                                  className="dropdown-panel animate-in fade-in zoom-in-95 z-[9999] w-48 p-1 duration-100"
                                  style={{
                                    position: "fixed",
                                    top: dropdownRect.bottom + 4,
                                    left: dropdownRect.right - 192,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => {
                                      routeInboxItem(item.id, "do");
                                      setActiveRouteItem(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                                  >
                                    <UiIcon
                                      className="h-4 w-4 text-[var(--color-do)]"
                                      icon={CheckCircle2}
                                    />{" "}
                                    Do (Task)
                                  </button>
                                  <button
                                    onClick={() => {
                                      routeInboxItem(item.id, "think");
                                      setActiveRouteItem(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                                  >
                                    <UiIcon
                                      className="h-4 w-4 text-[var(--color-think)]"
                                      icon={MessageSquare}
                                    />{" "}
                                    Think (Thread)
                                  </button>
                                  <button
                                    onClick={() => {
                                      routeInboxItem(item.id, "explore");
                                      setActiveRouteItem(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                                  >
                                    <UiIcon
                                      className="h-4 w-4 text-[var(--color-explore)]"
                                      icon={Compass}
                                    />{" "}
                                    Explore (Saved)
                                  </button>
                                  <button
                                    onClick={() => {
                                      routeInboxItem(item.id, "remember");
                                      setActiveRouteItem(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                                  >
                                    <UiIcon
                                      className="h-4 w-4 text-[var(--color-people)]"
                                      icon={Brain}
                                    />{" "}
                                    Remember (Person)
                                  </button>
                                  <button
                                    onClick={() => {
                                      routeInboxItem(item.id, "location");
                                      setActiveRouteItem(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                                  >
                                    <UiIcon
                                      className="h-4 w-4 text-[var(--color-people)]"
                                      icon={MapPin}
                                    />{" "}
                                    Locations
                                  </button>
                                </div>,
                                document.body,
                              )}
                          </div>
                          <Button
                            variant="icon"
                            onClick={() => dismissInboxItem(item.id)}
                            className="shrink-0 !border-transparent !bg-transparent hover:!bg-red-500/10 hover:!text-red-400"
                            title="Dismiss"
                          >
                            <UiIcon className="h-4 w-4" icon={X} />
                          </Button>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}

                {/* Removed People Briefing Preview */}
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
