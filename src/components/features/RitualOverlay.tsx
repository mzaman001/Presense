"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { createClient, safeMutate } from "@/lib/supabase";
import type { Database } from "@/types/database.types";
import { toast } from "sonner";
import { m, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  AlertTriangle,
  Sparkles,
  Moon,
  ArrowRight,
  Clock,
  BookOpen,
  Smile,
  ChevronLeft,
  Sun,
  Inbox,
  SkipForward,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useRouter } from "next/navigation";
import { Icon as UiIcon } from "@/components/ui/Icon";

// ─── WorkloadBar ──────────────────────────────────────────────────────────────
function WorkloadBar({ total, capacity }: { total: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min((total / capacity) * 100, 100) : 0;
  const isOver = capacity > 0 && total > capacity;

  return (
    <div className="space-y-3" data-testid="workload-bar">
      <div className="flex items-center justify-between">
        <span
          className="text-meta font-bold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          Daily Workload
        </span>
        <span
          className="text-ui font-bold tabular-nums"
          style={{
            color: isOver ? "var(--status-overdue)" : "var(--status-done)",
          }}
        >
          {total}m{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            / {capacity}m
          </span>
        </span>
      </div>

      <div
        className="relative h-[3px] overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: isOver
              ? "linear-gradient(90deg, var(--status-today), var(--status-overdue))"
              : "linear-gradient(90deg, var(--accent), var(--status-done))",
            boxShadow: isOver
              ? "0 0 8px var(--status-overdue)"
              : "0 0 8px var(--accent)",
          }}
        />
      </div>

      <AnimatePresence>
        {isOver && (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
            style={{
              background: "var(--status-overdue-dim)",
              border: "0.5px solid var(--status-overdue-border)",
            }}
          >
            <UiIcon
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--status-overdue)" }}
              icon={AlertTriangle}
            />
            <p
              className="text-meta leading-relaxed"
              style={{ color: "var(--text-3)" }}
            >
              Over capacity — consider snoozing a task or two. Rest is part of
              the plan.
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TriageCard ───────────────────────────────────────────────────────────────
function TriageCard({
  task,
  onAction,
}: {
  /* @todo: Untyped usage justified per TOOL-01 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: any;
  onAction: (id: string, action: "today" | "backlog" | "snooze") => void;
}) {
  const isOverdue =
    task.status === "overdue" ||
    (task.deadline &&
      new Date(task.deadline) < new Date(new Date().setHours(0, 0, 0, 0)));

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, scale: 0.96, filter: "blur(4px)" }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative rounded-2xl p-4"
      style={{
        background: "var(--surface-card)",
        border: "0.5px solid var(--border-card)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* top highlight */}
      <div
        className="absolute top-0 right-0 left-0 h-px rounded-t-2xl"
        style={{ background: "var(--border-card-top)" }}
      />

      <div className="mb-3.5 flex items-start gap-3">
        <div
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{
            background: isOverdue
              ? "var(--status-overdue-dim)"
              : "var(--surface-card)",
            border: `1px solid ${isOverdue ? "var(--status-overdue-border)" : "var(--border-default)"}`,
          }}
        >
          {isOverdue && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--status-overdue)" }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-body leading-snug font-semibold"
            style={{ color: "var(--text-1)" }}
          >
            {task.title}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="text-caption font-bold tracking-widest uppercase"
              style={{
                color: isOverdue
                  ? "var(--status-overdue)"
                  : "var(--text-muted)",
              }}
            >
              {task.status === "inbox" ? "Inbox" : "Overdue"}
            </span>
            {task.deadline && (
              <>
                <span style={{ color: "var(--border-default)" }}>·</span>
                <span
                  className="text-meta"
                  style={{ color: "var(--text-muted)" }}
                >
                  {new Date(task.deadline).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onAction(task.id, "today")}
          className="text-ui flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-semibold transition-all active:scale-[0.97]"
          style={{
            background: "var(--accent)",
            color: "var(--text-on-accent)",
            boxShadow: "var(--shadow-button-primary)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.boxShadow =
              "var(--shadow-button-primary-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.boxShadow = "var(--shadow-button-primary)")
          }
        >
          <UiIcon className="h-3.5 w-3.5" strokeWidth={2.5} icon={Check} /> Do
          Today
        </button>
        <button
          onClick={() => onAction(task.id, "snooze")}
          className="text-ui flex items-center gap-1.5 rounded-xl px-3 py-2 font-medium transition-all hover:brightness-110 active:scale-[0.97]"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "0.5px solid var(--border-default)",
            color: "var(--text-2)",
          }}
        >
          <UiIcon className="h-3.5 w-3.5" icon={Clock} /> Tomorrow
        </button>
        <button
          onClick={() => onAction(task.id, "backlog")}
          className="text-ui flex items-center gap-1.5 rounded-xl px-3 py-2 font-medium transition-all hover:brightness-110 active:scale-[0.97]"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "0.5px solid var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          <UiIcon className="h-3.5 w-3.5" icon={SkipForward} /> Backlog
        </button>
      </div>
    </m.div>
  );
}

// ─── RitualOverlay ────────────────────────────────────────────────────────────
interface RitualOverlayProps {
  isOpen?: boolean;
  type?: "morning" | "evening" | null;
  onClose?: () => void;
}

export function RitualOverlay({
  isOpen,
  type,
  onClose,
}: RitualOverlayProps = {}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const {
    activeRitual: storeActiveRitual,
    setActiveRitual: storeSetActiveRitual,
    userSettings,
    updateUserSetting,
    markMutation,
  } = useAppStore(
    useShallow((s) => ({
      activeRitual: s.activeRitual,
      setActiveRitual: s.setActiveRitual,
      userSettings: s.userSettings,
      updateUserSetting: s.updateUserSetting,
      markMutation: s.markMutation,
    })),
  );

  const activeRitual = type !== undefined ? type : storeActiveRitual;
  const isCurrentlyOpen =
    isOpen !== undefined ? isOpen : storeActiveRitual !== null;

  const handleClose = useCallback(() => {
    // Stamp close time so AppInitializer won't fire another ritual for 5 minutes
    localStorage.setItem("presense_ritual_closed_at", String(Date.now()));
    if (onClose) onClose();
    else storeSetActiveRitual(null);
  }, [onClose, storeSetActiveRitual]);

  const [step, setStep] = useState<1 | 2>(1);
  const [triageTasks, setTriageTasks] = useState<
    Database["public"]["Tables"]["items"]["Row"][]
  >([]);
  const [todayTasks, setTodayTasks] = useState<
    Database["public"]["Tables"]["items"]["Row"][]
  >([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<
    Database["public"]["Tables"]["items"]["Row"][]
  >([]);
  const [completedTasks, setCompletedTasks] = useState<
    Database["public"]["Tables"]["items"]["Row"][]
  >([]);
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const capacity = userSettings?.daily_capacity_minutes ?? 240;

  const [todayString, setTodayString] = useState(() =>
    new Date().toLocaleDateString("en-CA"),
  );

  useEffect(() => {
    const update = () => {
      setTodayString((prev) => {
        const next = new Date().toLocaleDateString("en-CA");
        return prev === next ? prev : next;
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") update();
    };
    const interval = setInterval(update, 60000);
    window.addEventListener("focus", update);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", update);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isCurrentlyOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLButtonElement
      )
        return;
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (activeRitual === "morning" && step === 1 && triageTasks.length > 0) {
        const firstTask = triageTasks[0];
        /* eslint-disable react-hooks/immutability */
        if (e.key === "Enter" || e.key === "1")
          handleTriageAction(firstTask.id, "today");
        if (e.key === "2") handleTriageAction(firstTask.id, "snooze");
        if (e.key === "3") handleTriageAction(firstTask.id, "backlog");
        /* eslint-enable react-hooks/immutability */
      }
      if (activeRitual === "morning" && step === 2 && e.key === "Backspace")
        setStep(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCurrentlyOpen, activeRitual, step, triageTasks, handleClose]);

  useEffect(() => {
    if (isCurrentlyOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isCurrentlyOpen]);

  useEffect(() => {
    if (!activeRitual) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(1);
    const fetchData = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      if (activeRitual === "morning") {
        const { data: tasks } = await supabase
          .from("items")
          .select("*")
          .in("status", ["inbox", "active", "overdue"]);
        if (tasks) {
          const todayStart = new Date().setHours(0, 0, 0, 0);
          /* @todo: Untyped usage justified per TOOL-01 */

          setTriageTasks(
            tasks.filter(
              (t) =>
                t.status === "inbox" ||
                t.status === "overdue" ||
                (t.status === "active" &&
                  t.deadline &&
                  new Date(t.deadline).getTime() < todayStart),
            ),
          );
          /* @todo: Untyped usage justified per TOOL-01 */

          setTodayTasks(
            tasks.filter(
              (t) =>
                t.status === "active" &&
                t.deadline &&
                new Date(t.deadline).getTime() >= todayStart &&
                new Date(t.deadline).getTime() < todayStart + 86400000,
            ),
          );
        }
      } else {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const startISO = new Date(todayStart).toISOString();
        const [{ data: completed }, { data: incomplete }, { data: logs }] =
          await Promise.all([
            supabase
              .from("items")
              .select("*")
              .eq("status", "done")
              .gte("completed_at", startISO),
            supabase.from("items").select("*").eq("status", "active"),
            supabase
              .from("session_logs")
              .select("*")
              .eq("type", "work")
              .gte("completed_at", startISO),
          ]);
        setCompletedTasks(completed || []);
        /* @todo: Untyped usage justified per TOOL-01 */

        setTriageTasks(
          (incomplete || []).filter(
            (t) =>
              t.deadline &&
              new Date(t.deadline).getTime() < todayStart + 86400000,
          ),
        );
        /* @todo: Untyped usage justified per TOOL-01 */

        setTomorrowTasks(
          (incomplete || []).filter(
            (t) =>
              t.deadline &&
              new Date(t.deadline).getTime() >= todayStart + 86400000 &&
              new Date(t.deadline).getTime() < todayStart + 86400000 * 2,
          ),
        );
        /* @todo: Untyped usage justified per TOOL-01 */

        setFocusMinutes(
          (logs || []).reduce(
            (s: number, l) => s + (l.duration_minutes || 0),
            0,
          ),
        );
        setReflection("");
      }
      setLoading(false);
    };
    fetchData();
  }, [activeRitual, supabase, todayString]);

  const handleTriageAction = async (
    taskId: string,
    action: "today" | "backlog" | "snooze",
  ) => {
    const task = triageTasks.find((t) => t.id === taskId);
    if (!task) return;

    setTriageTasks((prev) => prev.filter((t) => t.id !== taskId));
    const now = new Date();
    const payload =
      action === "today"
        ? { status: "active", deadline: now.toISOString() }
        : action === "snooze"
          ? {
              status: "active",
              deadline: new Date(now.getTime() + 86400000).toISOString(),
            }
          : { status: "active", deadline: null };

    if (action === "today")
      setTodayTasks((prev) => [...prev, { ...task, ...payload }]);

    try {
      const { error } = await supabase
        .from("items")
        .update(payload)
        .eq("id", taskId);
      if (error) throw error;
      markMutation("items");

      const actionLabels = {
        today: "Moved to Today",
        backlog: "Moved to Backlog",
        snooze: "Snoozed until tomorrow",
      };
      toast.success(actionLabels[action], {
        action: {
          label: "Undo",
          onClick: async () => {
            if (action === "today")
              setTodayTasks((prev) => prev.filter((t) => t.id !== taskId));
            setTriageTasks((prev) => [task, ...prev]);
            // BUG-38: check error before claiming the undo succeeded
            const { success } = await safeMutate(
              () =>
                supabase
                  .from("items")
                  .update({ status: task.status, deadline: task.deadline })
                  .eq("id", taskId),
              "Failed to undo",
            );
            if (!success) {
              if (action === "today")
                setTodayTasks((prev) => [...prev, { ...task, ...payload }]);
              setTriageTasks((prev) => prev.filter((t) => t.id !== taskId));
              return;
            }
            markMutation("items");
          },
        },
      });
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleEstimateChange = async (taskId: string, minutes: number) => {
    const val = Math.max(0, minutes);
    const previousEstimate =
      todayTasks.find((t) => t.id === taskId)?.time_estimate ?? null;
    setTodayTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, time_estimate: val } : t)),
    );
    // BUG-38: safeMutate checks the DB error (try/catch alone does not)
    const { success } = await safeMutate(
      () =>
        supabase.from("items").update({ time_estimate: val }).eq("id", taskId),
      "Failed to update estimate",
    );
    if (!success) {
      setTodayTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, time_estimate: previousEstimate } : t,
        ),
      );
      return;
    }
    markMutation("items");
  };

  const handleFinishMorning = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { error } = await supabase
        .from("user_settings")
        .update({
          last_ritual_date: todayString,
        })
        .eq("user_id", user.id);
      if (error) throw error;

      const { error: logError } = await supabase
        .from("ritual_logs")
        .insert({ user_id: user.id, ritual_type: "morning" });
      if (logError) console.error("Failed to log morning ritual:", logError);

      updateUserSetting("last_ritual_date", todayString);
      toast.success("Morning planning done — have a focused day!", {
        icon: <UiIcon className="h-4 w-4 text-orange-400" icon={Sun} />,
      });
      handleClose();
      router.push("/");
    } catch (err: unknown) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCarryOver = async (taskId: string) => {
    const task = triageTasks.find((t) => t.id === taskId);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setTriageTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const { error } = await supabase
        .from("items")
        .update({ deadline: tomorrow.toISOString() })
        .eq("id", taskId);
      if (error) throw error;
      markMutation("items");

      toast.success("Carried over to tomorrow", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (task) {
              setTriageTasks((prev) => [task, ...prev]);
              // BUG-38: check error before claiming the undo succeeded
              const { success } = await safeMutate(
                () =>
                  supabase
                    .from("items")
                    .update({ deadline: task.deadline })
                    .eq("id", taskId),
                "Failed to undo",
              );
              if (!success) {
                setTriageTasks((prev) => prev.filter((t) => t.id !== taskId));
                return;
              }
              markMutation("items");
            }
          },
        },
      });
    } catch {
      toast.error("Failed to carry over");
    }
  };

  const handleFinishEvening = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      if (reflection.trim()) {
        const dateStr = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const title = `Daily Note: ${dateStr}`;
        const { data: existing } = await supabase
          .from("threads")
          .select("*")
          .eq("title", title)
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1);
        /* @todo: Untyped usage justified per TOOL-01 */

        let threadId = "",
          entries: Database["public"]["Tables"]["threads"]["Row"]["entries"] =
            [];
        if (existing && existing.length > 0) {
          threadId = existing[0].id;
          entries = existing[0].entries || [];
        } else {
          const { data: ins, error: insError } = await supabase
            .from("threads")
            .insert({
              user_id: user.id,
              title,
              color_accent: "#E5B41E",
              is_pinned: true,
              entries: [],
            })
            .select("*")
            .single();
          if (insError) throw insError;
          if (ins) {
            threadId = ins.id;
          }
        }
        if (threadId) {
          // BUG-38: check error before showing the success toast
          const { error: updError } = await supabase
            .from("threads")
            .update({
              entries: [
                ...entries,
                {
                  text: reflection.trim(),
                  created_at: new Date().toISOString(),
                },
              ],
              last_updated: new Date().toISOString(),
            })
            .eq("id", threadId);
          if (updError) throw updError;
          markMutation("threads");
        }
      }

      const { error } = await supabase
        .from("user_settings")
        .update({
          last_evening_ritual_date: todayString,
        })
        .eq("user_id", user.id);
      if (error) throw error;

      const { error: logError } = await supabase
        .from("ritual_logs")
        .insert({ user_id: user.id, ritual_type: "evening" });
      if (logError) console.error("Failed to log evening ritual:", logError);

      updateUserSetting("last_evening_ritual_date", todayString);
      toast.success("Shutdown complete. Rest well.", {
        icon: <UiIcon className="h-4 w-4 text-blue-400" icon={Moon} />,
      });
      handleClose();
    } catch (err: unknown) {
      toast.error("Failed to complete evening ritual", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // BUG-38: check error before claiming the skip succeeded
      if (activeRitual === "morning") {
        const { success } = await safeMutate(
          () =>
            supabase
              .from("user_settings")
              .update({ last_ritual_date: todayString })
              .eq("user_id", user.id),
          "Failed to skip ritual",
        );
        if (!success) return;
        updateUserSetting("last_ritual_date", todayString);
      } else {
        const { success } = await safeMutate(
          () =>
            supabase
              .from("user_settings")
              .update({ last_evening_ritual_date: todayString })
              .eq("user_id", user.id),
          "Failed to skip ritual",
        );
        if (!success) return;
        updateUserSetting("last_evening_ritual_date", todayString);
      }
    }
    toast.success(
      "Ritual skipped for today. You can always open it from the sidebar.",
    );
    handleClose();
  };

  const totalEstimate = todayTasks.reduce(
    (s, t) => s + (t.time_estimate || 0),
    0,
  );
  const isMorning = activeRitual === "morning";

  if (!isCurrentlyOpen || !activeRitual) return null;

  return (
    <AnimatePresence>
      <m.div
        key="ritual-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
        }}
        data-testid="ritual-overlay"
      >
        {/* Ambient glow orbs behind modal */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: isMorning
              ? "radial-gradient(circle, rgba(229,180,30,0.10) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(129,140,248,0.08) 0%, transparent 70%)",
            transform: "translate(-30%, -40%)",
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: isMorning
              ? "radial-gradient(circle, rgba(235,66,51,0.06) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(45,212,191,0.06) 0%, transparent 70%)",
            transform: "translate(60%, 50%)",
          }}
        />

        <m.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative flex max-h-[88vh] w-full max-w-[480px] flex-col overflow-hidden"
          style={{
            background: "var(--surface-modal)",
            backdropFilter: "var(--glass-blur-heavy)",
            WebkitBackdropFilter: "var(--glass-blur-heavy)",
            border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-2xl)",
            boxShadow: "var(--shadow-modal), 0 0 60px rgba(0,0,0,0.5)",
          }}
        >
          {/* Top shimmer line */}
          <div
            className="pointer-events-none absolute top-0 right-8 left-8 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--border-card-top), transparent)",
            }}
          />

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-4">
            <div className="flex items-center gap-3.5">
              {/* Icon with glow ring */}
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-xl opacity-60 blur-sm"
                  style={{
                    background: "var(--accent-dim)",
                    transform: "scale(1.3)",
                  }}
                />
                <div
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent-dim) 0%, rgba(255,255,255,0.03) 100%)",
                    border: "0.5px solid var(--accent-border)",
                  }}
                >
                  {isMorning ? (
                    <UiIcon
                      className="h-4.5 w-4.5"
                      style={{ color: "var(--accent)" }}
                      strokeWidth={1.8}
                      icon={Sun}
                    />
                  ) : (
                    <UiIcon
                      className="h-4.5 w-4.5"
                      style={{ color: "var(--accent)" }}
                      strokeWidth={1.8}
                      icon={Moon}
                    />
                  )}
                </div>
              </div>

              <div>
                <h2
                  className="text-title-sm leading-none font-bold tracking-tight"
                  style={{ color: "var(--text-1)" }}
                >
                  {isMorning ? "Morning Planning" : "Evening Review"}
                </h2>
                <p
                  className="text-meta mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isMorning
                    ? step === 1
                      ? "Step 1 of 2 — Triage your inbox"
                      : "Step 2 of 2 — Commit your day"
                    : "Shutdown ritual"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Step pills */}
              {isMorning && (
                <div className="flex items-center gap-1.5">
                  {[1, 2].map((s) => (
                    <m.div
                      key={s}
                      animate={{
                        width: step === s ? 20 : 6,
                        opacity: step === s ? 1 : 0.35,
                      }}
                      transition={{
                        duration: 0.3,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                      className="h-1.5 rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={handleSkip}
                className="text-meta font-medium transition-all hover:text-white"
                style={{ color: "var(--text-muted)" }}
              >
                Skip today
              </button>
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "0.5px solid var(--border-default)",
                  color: "var(--text-3)",
                }}
                aria-label="Close"
              >
                <UiIcon className="h-3.5 w-3.5" icon={X} />
              </button>
            </div>
          </div>

          {/* Separator */}
          <div
            className="mx-6 mb-4"
            style={{ height: "0.5px", background: "var(--border-subtle)" }}
          />

          {/* ── Body ──────────────────────────────────────────── */}
          <div className="flex-1 scrollbar-thin space-y-4 overflow-y-auto overscroll-contain px-6 pb-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div
                  className="h-9 w-9 animate-spin rounded-full border-2 border-t-transparent"
                  style={{
                    borderColor: "var(--accent-border)",
                    borderTopColor: "var(--accent)",
                  }}
                />
                <p className="text-ui" style={{ color: "var(--text-muted)" }}>
                  Preparing your ritual…
                </p>
              </div>
            ) : isMorning ? (
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  /* Step 1: Triage */
                  <m.div
                    key="step1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {triageTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-12">
                        <div
                          className="flex h-14 w-14 items-center justify-center rounded-2xl"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(74,222,128,0.12), rgba(74,222,128,0.04))",
                            border: "0.5px solid rgba(74,222,128,0.2)",
                            boxShadow: "0 0 24px rgba(74,222,128,0.08)",
                          }}
                        >
                          <UiIcon
                            className="h-7 w-7"
                            style={{ color: "var(--status-done)" }}
                            strokeWidth={1.5}
                            icon={Smile}
                          />
                        </div>
                        <div className="text-center">
                          <p
                            className="text-title-sm font-semibold"
                            style={{ color: "var(--text-1)" }}
                          >
                            Inbox is clear
                          </p>
                          <p
                            className="text-ui mt-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            No inbox or overdue tasks to triage.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UiIcon
                              className="h-3.5 w-3.5"
                              style={{ color: "var(--text-muted)" }}
                              icon={Inbox}
                            />
                            <span
                              className="text-meta font-bold tracking-widest uppercase"
                              style={{ color: "var(--text-muted)" }}
                            >
                              To triage
                            </span>
                          </div>
                          <span
                            className="text-meta rounded-full px-2 py-0.5 font-bold"
                            style={{
                              background: "var(--accent-dim)",
                              color: "var(--accent)",
                              border: "0.5px solid var(--accent-border)",
                            }}
                          >
                            {triageTasks.length} left
                          </span>
                        </div>
                        <AnimatePresence mode="popLayout">
                          {triageTasks.map((task) => (
                            <TriageCard
                              key={task.id}
                              task={task}
                              onAction={handleTriageAction}
                            />
                          ))}
                        </AnimatePresence>
                      </>
                    )}
                  </m.div>
                ) : (
                  /* Step 2: Commit */
                  <m.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {todayTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-12">
                        <div
                          className="flex h-14 w-14 items-center justify-center rounded-2xl"
                          style={{
                            background: "var(--accent-dim)",
                            border: "0.5px solid var(--accent-border)",
                            boxShadow: "0 0 24px var(--accent-glow)",
                          }}
                        >
                          <UiIcon
                            className="h-7 w-7"
                            style={{ color: "var(--accent)" }}
                            strokeWidth={1.5}
                            icon={Sparkles}
                          />
                        </div>
                        <div className="text-center">
                          <p
                            className="text-title-sm font-semibold"
                            style={{ color: "var(--text-1)" }}
                          >
                            No tasks for today
                          </p>
                          <p
                            className="text-ui mt-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Go back and mark some tasks as &ldquo;Do
                            Today&rdquo;.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-1 flex items-center gap-2">
                          <UiIcon
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--text-muted)" }}
                            icon={Clock}
                          />
                          <span
                            className="text-meta font-bold tracking-widest uppercase"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Today&apos;s tasks
                          </span>
                        </div>

                        <div
                          className="divide-y overflow-hidden rounded-2xl"
                          style={{
                            background: "var(--surface-card)",
                            border: "0.5px solid var(--border-card)",
                            borderCollapse: "collapse",
                          }}
                        >
                          {todayTasks.map((task, i) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between gap-4 px-4 py-3"
                              style={{
                                borderBottom:
                                  i < todayTasks.length - 1
                                    ? "0.5px solid var(--border-subtle)"
                                    : "none",
                              }}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                                  style={{
                                    background: "var(--accent-dim)",
                                    border: "0.5px solid var(--accent-border)",
                                  }}
                                >
                                  <div
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ background: "var(--accent)" }}
                                  />
                                </div>
                                <p
                                  className="text-body truncate font-medium"
                                  style={{ color: "var(--text-1)" }}
                                >
                                  {task.title}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="5"
                                  value={task.time_estimate || 25}
                                  onChange={(e) =>
                                    handleEstimateChange(
                                      task.id,
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  className="text-body w-14 rounded-lg px-2 py-1.5 text-center font-bold transition-all focus:outline-none"
                                  style={{
                                    background: "var(--surface-input)",
                                    border: "0.5px solid var(--border-input)",
                                    color: "var(--text-1)",
                                  }}
                                  onFocus={(e) =>
                                    (e.target.style.borderColor =
                                      "var(--accent)")
                                  }
                                  onBlur={(e) =>
                                    (e.target.style.borderColor =
                                      "var(--border-input)")
                                  }
                                />
                                <span
                                  className="text-meta w-6"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  min
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <WorkloadBar
                          total={totalEstimate}
                          capacity={capacity}
                        />
                      </>
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            ) : (
              /* Evening Flow */
              <div className="space-y-5">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="relative overflow-hidden rounded-2xl px-4 py-4"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--accent-dim) 0%, rgba(255,255,255,0.02) 100%)",
                      border: "0.5px solid var(--accent-border)",
                    }}
                  >
                    <div
                      className="absolute top-0 right-0 left-0 h-px"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, var(--accent-border), transparent)",
                      }}
                    />
                    <p
                      className="text-caption mb-2 font-bold tracking-widest uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Completed
                    </p>
                    <p
                      className="text-[32px] leading-none font-bold tracking-tight"
                      style={{ color: "var(--text-1)" }}
                    >
                      {completedTasks.length}
                    </p>
                    <p
                      className="text-meta mt-1.5"
                      style={{ color: "var(--status-done)" }}
                    >
                      tasks done today
                    </p>
                  </div>

                  <div
                    className="relative overflow-hidden rounded-2xl px-4 py-4"
                    style={{
                      background: "var(--surface-card)",
                      border: "0.5px solid var(--border-card)",
                    }}
                  >
                    <div
                      className="absolute top-0 right-0 left-0 h-px"
                      style={{ background: "var(--border-card-top)" }}
                    />
                    <p
                      className="text-caption mb-2 font-bold tracking-widest uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Focus Time
                    </p>
                    <p
                      className="text-[32px] leading-none font-bold tracking-tight"
                      style={{ color: "var(--text-1)" }}
                    >
                      {focusMinutes}
                      <span
                        className="text-title-md ml-0.5"
                        style={{ color: "var(--text-3)" }}
                      >
                        m
                      </span>
                    </p>
                    <p
                      className="text-meta mt-1.5"
                      style={{ color: "var(--accent)" }}
                    >
                      Pomodoros logged
                    </p>
                  </div>
                </div>

                {/* Completed list */}
                {completedTasks.length > 0 && (
                  <div className="space-y-2">
                    <p
                      className="text-meta font-bold tracking-widest uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Done today
                    </p>
                    <div
                      className="max-h-32 overflow-hidden overflow-y-auto overscroll-contain rounded-2xl"
                      style={{
                        background: "var(--surface-card)",
                        border: "0.5px solid var(--border-card)",
                      }}
                    >
                      {completedTasks.map((t, i) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 px-4 py-2.5"
                          style={{
                            borderBottom:
                              i < completedTasks.length - 1
                                ? "0.5px solid var(--border-subtle)"
                                : "none",
                          }}
                        >
                          <div
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                            style={{
                              background: "rgba(74,222,128,0.12)",
                              border: "0.5px solid rgba(74,222,128,0.25)",
                            }}
                          >
                            <UiIcon
                              className="h-2.5 w-2.5"
                              strokeWidth={3}
                              style={{ color: "var(--status-done)" }}
                              icon={Check}
                            />
                          </div>
                          <p
                            className="text-ui truncate line-through"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {t.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Carry over */}
                {triageTasks.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p
                        className="text-meta font-bold tracking-widest uppercase"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Carry over
                      </p>
                      <span
                        className="text-meta"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {triageTasks.length} incomplete
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <AnimatePresence mode="popLayout">
                        {triageTasks.map((t) => (
                          <m.div
                            key={t.id}
                            layout
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
                            style={{
                              background: "var(--surface-card)",
                              border: "0.5px solid var(--border-card)",
                            }}
                          >
                            <p
                              className="text-ui flex-1 truncate"
                              style={{ color: "var(--text-2)" }}
                            >
                              {t.title}
                            </p>
                            <button
                              onClick={() => handleCarryOver(t.id)}
                              className="text-meta shrink-0 rounded-lg px-3 py-1.5 font-semibold transition-all hover:scale-105 active:scale-95"
                              style={{
                                background: "var(--accent-dim)",
                                color: "var(--accent-text)",
                                border: "0.5px solid var(--accent-border)",
                              }}
                            >
                              → Tomorrow
                            </button>
                          </m.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Tomorrow Preview */}
                {tomorrowTasks.length > 0 && (
                  <div className="space-y-2">
                    <p
                      className="text-meta font-bold tracking-widest uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Up next tomorrow
                    </p>
                    <div
                      className="max-h-32 overflow-hidden overflow-y-auto overscroll-contain rounded-2xl"
                      style={{
                        background: "var(--surface-card)",
                        border: "0.5px solid var(--border-card)",
                      }}
                    >
                      {tomorrowTasks.map((t, i) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 px-4 py-2.5 opacity-60"
                          style={{
                            borderBottom:
                              i < tomorrowTasks.length - 1
                                ? "0.5px solid var(--border-subtle)"
                                : "none",
                          }}
                        >
                          <div
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                            style={{
                              background: "var(--accent-dim)",
                              border: "0.5px solid var(--accent-border)",
                            }}
                          >
                            <div
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: "var(--accent)" }}
                            />
                          </div>
                          <p
                            className="text-ui truncate"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {t.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reflection */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <UiIcon
                      className="h-3.5 w-3.5"
                      style={{ color: "var(--text-muted)" }}
                      icon={BookOpen}
                    />
                    <p
                      className="text-meta font-bold tracking-widest uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Daily Reflection
                    </p>
                  </div>
                  <TextareaAutosize
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="What went well today? What is your ONE thing for tomorrow?"
                    minRows={3}
                    className="text-body w-full resize-none rounded-xl px-4 py-3 leading-relaxed transition-all focus:outline-none"
                    style={{
                      background: "var(--surface-input)",
                      border: "0.5px solid var(--border-input)",
                      color: "var(--text-1)",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--accent)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "var(--border-input)")
                    }
                  />
                  <p
                    className="text-caption"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Saved to your Daily Note in Think.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div
            className="flex shrink-0 items-center justify-between px-6 py-4"
            style={{ borderTop: "0.5px solid var(--border-subtle)" }}
          >
            {isMorning && step === 2 ? (
              <button
                onClick={() => setStep(1)}
                className="text-body flex items-center gap-1.5 rounded-xl px-3 py-2 font-medium transition-all hover:brightness-110 active:scale-95"
                style={{
                  color: "var(--text-3)",
                  background: "rgba(255,255,255,0.04)",
                  border: "0.5px solid var(--border-default)",
                }}
              >
                <UiIcon className="h-4 w-4" icon={ChevronLeft} /> Back
              </button>
            ) : (
              <button
                onClick={handleSkip}
                className="text-body px-2 py-1 font-medium transition-colors hover:text-[var(--text-2)]"
                style={{ color: "var(--text-muted)" }}
              >
                Skip today
              </button>
            )}

            {isMorning ? (
              step === 1 ? (
                <m.button
                  whileTap={{ scale: 0.97 }}
                  disabled={triageTasks.length > 0}
                  onClick={() => setStep(2)}
                  className="text-body flex items-center gap-2 rounded-full px-5 py-2.5 font-bold transition-all disabled:cursor-not-allowed disabled:opacity-35"
                  style={{
                    background:
                      triageTasks.length > 0
                        ? "rgba(255,255,255,0.06)"
                        : "var(--accent)",
                    color:
                      triageTasks.length > 0
                        ? "var(--text-3)"
                        : "var(--text-on-accent)",
                    boxShadow:
                      triageTasks.length > 0
                        ? "none"
                        : "var(--shadow-button-primary)",
                    border:
                      triageTasks.length > 0
                        ? "0.5px solid var(--border-default)"
                        : "none",
                  }}
                >
                  Next <UiIcon className="h-4 w-4" icon={ArrowRight} />
                </m.button>
              ) : (
                <m.button
                  whileTap={{ scale: 0.97 }}
                  disabled={saving}
                  onClick={handleFinishMorning}
                  className="text-body-lg flex items-center gap-2 rounded-full px-6 py-3 font-bold transition-all"
                  style={{
                    background: "var(--accent)",
                    color: "var(--text-on-accent)",
                    boxShadow:
                      "0 4px 20px var(--accent-glow), inset 0 1px 1px rgba(255,255,255,0.2)",
                  }}
                >
                  {saving ? "Saving…" : "Lock in my day"}{" "}
                  <UiIcon className="h-4 w-4" icon={Sparkles} />
                </m.button>
              )
            ) : (
              <m.button
                whileTap={{ scale: 0.97 }}
                disabled={saving}
                onClick={handleFinishEvening}
                className="text-body flex items-center gap-2 rounded-full px-5 py-2.5 font-bold transition-all"
                style={{
                  background: "var(--accent)",
                  color: "var(--text-on-accent)",
                  boxShadow: "var(--shadow-button-primary)",
                }}
              >
                {saving ? "Saving…" : "Shut down"}{" "}
                <UiIcon className="h-4 w-4" icon={Moon} />
              </m.button>
            )}
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}

export default RitualOverlay;
