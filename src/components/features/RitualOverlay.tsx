"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useUserId } from "@/components/providers/SessionProvider";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { createClient, safeMutate } from "@/lib/supabase";
import type { Database } from "@/types/database.types";
import { toast } from "sonner";
import { m, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Moon,
  ArrowRight,
  ChevronLeft,
  Sun,
  Sunrise,
  CloudSun,
  Loader2,
  CalendarDays,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useRouter } from "next/navigation";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { useHaptics } from "@/hooks/useHaptics";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { cn } from "@/lib/utils";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import {
  activateItemWithDeadlinePatch,
  moveItemToTrashPatch,
  restoreItemPatch,
  revertItemPatch,
} from "@/lib/item-lifecycle";
import { flushOutbox } from "@/lib/capture-outbox";
import {
  MindSweepPrompt,
  eveningSweepPrompts,
} from "@/components/features/MindSweep";

// ─── WorkloadBar ──────────────────────────────────────────────────────────────
// Planned minutes against the daily capacity from Settings. One calm bar;
// the over-capacity note is advice, not an alarm.
function WorkloadBar({ total, capacity }: { total: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min((total / capacity) * 100, 100) : 0;
  const isOver = capacity > 0 && total > capacity;
  const fmt = (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;

  return (
    <div className="space-y-2.5" data-testid="workload-bar">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[length:var(--text-ui)] font-medium text-[var(--text-2)]">
          Planned
        </span>
        <span className="text-[length:var(--text-ui)] text-[var(--text-3)] tabular-nums">
          <span
            className={cn(
              "font-heading text-[length:var(--text-title-md)]",
              isOver ? "text-[var(--status-today)]" : "text-[var(--text-1)]",
            )}
          >
            {fmt(total)}
          </span>{" "}
          of {fmt(capacity)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-active)]">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "h-full rounded-full",
            isOver ? "bg-[var(--status-today)]" : "bg-[var(--accent)]",
          )}
        />
      </div>
      <AnimatePresence initial={false}>
        {isOver && (
          <m.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden text-[length:var(--text-ui)] leading-relaxed text-[var(--text-3)]"
          >
            That&apos;s more than your day holds. Consider moving one or two to
            tomorrow. Rest is part of the plan.
          </m.p>
        )}
      </AnimatePresence>
    </div>
  );
}

type TriageAction = "today" | "backlog" | "snooze";

// ─── TriageRow ────────────────────────────────────────────────────────────────
// One loose end, three equal choices. A flat row in a list, not a card inside
// a card; it folds away when a choice is made.
function TriageRow({
  task,
  onAction,
}: {
  task: Database["public"]["Tables"]["items"]["Row"];
  onAction: (id: string, action: TriageAction) => void;
}) {
  const isOverdue =
    task.status === "overdue" ||
    (task.deadline &&
      new Date(task.deadline) < new Date(new Date().setHours(0, 0, 0, 0)));

  const choices: { action: TriageAction; label: string; icon: typeof Sun }[] = [
    { action: "today", label: "Today", icon: Sun },
    { action: "snooze", label: "Tomorrow", icon: Sunrise },
    { action: "backlog", label: "Someday", icon: CloudSun },
  ];

  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden px-4 py-3.5"
    >
      <p className="text-[length:var(--text-body-lg)] leading-snug text-[var(--text-1)]">
        {task.title}
      </p>
      <p className="mt-0.5 text-[length:var(--text-meta)] text-[var(--text-3)]">
        {isOverdue ? (
          <span className="text-[var(--status-overdue)]">Overdue</span>
        ) : (
          "In your inbox"
        )}
        {task.deadline && (
          <>
            {" · "}
            {new Date(task.deadline).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </>
        )}
      </p>
      <div
        role="group"
        aria-label={`When will you do "${task.title}"?`}
        className="mt-3 grid grid-cols-3 gap-1.5"
      >
        {choices.map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(task.id, action)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-full text-[length:var(--text-ui)] font-medium transition-[background-color,color,transform] duration-[var(--dur-fast)] active:scale-[0.97]",
              action === "today"
                ? "bg-[var(--accent-dim)] text-[var(--accent-text)] hover:bg-[var(--accent-dim-hover)]"
                : "bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-active)] hover:text-[var(--text-1)]",
            )}
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>
    </m.li>
  );
}

// ─── StillOpenRow ─────────────────────────────────────────────────────────────
// An evening leftover and three neutral choices: carry it, pick a day, or let
// it go. Nothing is labelled overdue or failed.
function StillOpenRow({
  title,
  onTomorrow,
  onPickDay,
  onDrop,
}: {
  title: string;
  onTomorrow: () => void;
  onPickDay: (day: string) => void;
  onDrop: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDay = tomorrow.toLocaleDateString("en-CA");

  return (
    <div className="flex w-full flex-col gap-2 py-1">
      <p className="min-w-0 truncate text-[length:var(--text-body)] text-[var(--text-2)]">
        {title}
      </p>
      <div
        role="group"
        aria-label={`What to do with "${title}"`}
        className="flex flex-wrap items-center gap-1.5"
      >
        <button type="button" onClick={onTomorrow} className="chip chip-sm">
          <Sunrise aria-hidden="true" className="size-3.5" />
          Tomorrow
        </button>
        {picking ? (
          <input
            type="date"
            autoFocus
            min={minDay}
            aria-label={`Pick a day for "${title}"`}
            onChange={(e) => {
              if (e.target.value) onPickDay(e.target.value);
            }}
            onBlur={() => setPicking(false)}
            className="input !h-8 !w-auto !rounded-full !px-3 !py-0 !text-[length:var(--text-ui)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="chip chip-sm"
          >
            <CalendarDays aria-hidden="true" className="size-3.5" />
            Pick a day
          </button>
        )}
        <button type="button" onClick={onDrop} className="chip chip-sm">
          <X aria-hidden="true" className="size-3.5" />
          Let it go
        </button>
      </div>
    </div>
  );
}

// Quiet centred message for an empty step.
function RitualEmpty({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Sun;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent-dim)]">
        <Icon
          aria-hidden="true"
          className="size-5 text-[var(--accent-text)]"
          strokeWidth={1.75}
        />
      </span>
      <p className="font-heading text-[length:var(--text-title-md)] text-[var(--text-1)]">
        {title}
      </p>
      {children && (
        <div className="mt-1.5 max-w-xs text-[length:var(--text-body)] text-[var(--text-3)]">
          {children}
        </div>
      )}
    </div>
  );
}

// Section label inside the ritual: sentence case, with an optional count.
function RitualSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-[length:var(--text-ui)] font-medium text-[var(--text-2)]">
          {title}
        </h3>
        {aside && (
          <span className="text-[length:var(--text-ui)] text-[var(--text-3)] tabular-nums">
            {aside}
          </span>
        )}
      </div>
      {children}
    </section>
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
  const userId = useUserId();
  const router = useRouter();
  const haptics = useHaptics();
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
  // Move focus into the ritual and keep it there while it's open.
  const dialogRef = useDialogFocus(isCurrentlyOpen);

  const handleClose = useCallback(() => {
    // Stamp close time so AppInitializer holds off re-prompting (RITUAL_SNOOZE_MS)
    localStorage.setItem("presense_ritual_closed_at", String(Date.now()));
    if (onClose) onClose();
    else storeSetActiveRitual(null);
  }, [onClose, storeSetActiveRitual]);

  // Morning: 0 = empty your head, 1 = sort loose ends, 2 = shape the day.
  const [step, setStep] = useState<0 | 1 | 2>(0);
  // Anything captured in the morning sweep; if so, sorting reloads first so
  // what just landed in Inbox is there to place.
  const [sweptCount, setSweptCount] = useState(0);
  const [advancing, setAdvancing] = useState(false);
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
        if (!e.defaultPrevented) handleClose();
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

  const loadData = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!quiet) setLoading(true);
      try {
        if (activeRitual === "morning") {
          // INFRA-18: explicit user_id filter for planner index usage.
          const { data: tasks } = await supabase
            .from("items")
            .select("*")
            .eq("user_id", userId)
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
          // INFRA-18: explicit user_id filter for planner index usage.
          const [{ data: completed }, { data: incomplete }, { data: logs }] =
            await Promise.all([
              supabase
                .from("items")
                .select("*")
                .eq("user_id", userId)
                .eq("status", "done")
                .gte("completed_at", startISO),
              supabase
                .from("items")
                .select("*")
                .eq("user_id", userId)
                .eq("status", "active"),
              supabase
                .from("session_logs")
                .select("*")
                .eq("user_id", userId)
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
      } catch {
        toast.error("Couldn't load your ritual. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [activeRitual, supabase, userId],
  );

  useEffect(() => {
    if (!activeRitual) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(0);
    setSweptCount(0);
    void loadData();
  }, [activeRitual, loadData, todayString]);

  /** Morning: leave the sweep for sorting, with anything just captured. */
  const continueFromSweep = async () => {
    if (sweptCount > 0) {
      setAdvancing(true);
      // Wait for the captures to reach the database so they're listed.
      await flushOutbox(supabase, userId).catch(() => undefined);
      await loadData({ quiet: true });
      setAdvancing(false);
    }
    setStep(1);
  };

  const handleTriageAction = async (
    taskId: string,
    action: "today" | "backlog" | "snooze",
  ) => {
    const task = triageTasks.find((t) => t.id === taskId);
    if (!task) return;

    setTriageTasks((prev) => prev.filter((t) => t.id !== taskId));
    const now = new Date();
    // INFRA-19: status transition through item-lifecycle; the deadline math
    // stays here (scheduling, not lifecycle state).
    const payload =
      action === "today"
        ? activateItemWithDeadlinePatch(now.toISOString())
        : action === "snooze"
          ? activateItemWithDeadlinePatch(
              new Date(now.getTime() + 86400000).toISOString(),
            )
          : activateItemWithDeadlinePatch(null);

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
        today: "Added to today",
        backlog: "Saved for someday",
        snooze: "Moved to tomorrow",
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
                  .update(revertItemPatch(task.status, task.deadline))
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
      const { error } = await supabase
        .from("user_settings")
        .update({
          last_ritual_date: todayString,
        })
        .eq("user_id", userId);
      if (error) throw error;

      const { error: logError } = await supabase
        .from("ritual_logs")
        .insert({ user_id: userId, ritual_type: "morning" });
      if (logError) console.error("Failed to log morning ritual:", logError);

      updateUserSetting("last_ritual_date", todayString);
      toast.success("Morning planning done — have a focused day!", {
        icon: (
          <UiIcon className="h-4 w-4 text-[var(--accent-text)]" icon={Sun} />
        ),
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

  /**
   * Evening leftovers: carry to tomorrow or to a chosen day, keeping the
   * task's time of day. A neutral decision, never an "overdue" pile.
   */
  const handleCarryOver = async (taskId: string, day?: string) => {
    const task = triageTasks.find((t) => t.id === taskId);
    let target: Date;
    if (day) {
      const [y, mo, d] = day.split("-").map(Number);
      target = task?.deadline ? new Date(task.deadline) : new Date();
      target.setFullYear(y, mo - 1, d);
      if (!task?.deadline) target.setHours(23, 59, 0, 0);
    } else {
      target = new Date();
      target.setDate(target.getDate() + 1);
    }
    setTriageTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const { error } = await supabase
        .from("items")
        .update({ deadline: target.toISOString() })
        .eq("id", taskId);
      if (error) throw error;
      markMutation("items");

      const label = day
        ? `Moved to ${target.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}`
        : "Carried over to tomorrow";
      toast.success(label, {
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

  /** "Let it go": to Trash, with Undo. Dropping is a valid decision. */
  const handleDrop = async (taskId: string) => {
    const task = triageTasks.find((t) => t.id === taskId);
    if (!task) return;
    setTriageTasks((prev) => prev.filter((t) => t.id !== taskId));
    const { success } = await safeMutate(
      () =>
        supabase.from("items").update(moveItemToTrashPatch()).eq("id", taskId),
      "Couldn't drop the task",
    );
    if (!success) {
      setTriageTasks((prev) => [task, ...prev]);
      return;
    }
    markMutation("items");
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
                .eq("id", taskId),
            "Failed to undo",
          );
          if (!restored) return;
          markMutation("items");
          setTriageTasks((prev) => [task, ...prev]);
        },
      },
    });
  };

  const handleFinishEvening = async () => {
    setSaving(true);
    try {
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
          .eq("user_id", userId)
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
              user_id: userId,
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
        .eq("user_id", userId);
      if (error) throw error;

      const { error: logError } = await supabase
        .from("ritual_logs")
        .insert({ user_id: userId, ritual_type: "evening" });
      if (logError) console.error("Failed to log evening ritual:", logError);

      updateUserSetting("last_evening_ritual_date", todayString);
      toast.success("Shutdown complete. Rest well.", {
        icon: (
          <UiIcon
            className="h-4 w-4 text-[var(--status-someday)]"
            icon={Moon}
          />
        ),
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
    if (userId) {
      // BUG-38: check error before claiming the skip succeeded
      if (activeRitual === "morning") {
        const { success } = await safeMutate(
          () =>
            supabase
              .from("user_settings")
              .update({ last_ritual_date: todayString })
              .eq("user_id", userId),
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
              .eq("user_id", userId),
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
  // Local noon of today, so the prompts rotate on the viewer's own date.
  const eveningPrompts = eveningSweepPrompts(new Date(`${todayString}T12:00`));

  if (!isCurrentlyOpen || !activeRitual) return null;

  const hour = new Date().getHours();
  const heading = isMorning
    ? step === 0
      ? hour < 12
        ? "Good morning."
        : "Let's plan the day."
      : step === 1
        ? "Sort the loose ends."
        : "Shape your day."
    : "Let the day go.";
  const guidance = isMorning
    ? step === 0
      ? "First, empty your head. Anything at all, one at a time."
      : step === 1
        ? "Give each one a place."
        : "This is what you've chosen for today. Estimates keep it honest."
    : "Close the open loops, empty your head, and rest.";

  return (
    <AnimatePresence>
      <m.div
        key="ritual-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--bg-overlay)] md:items-center md:p-6"
        data-testid="ritual-overlay"
      >
        <m.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ritual-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16, transition: { duration: 0.18 } }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="modal relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--sheet-radius)] rounded-b-none md:max-h-[86vh] md:max-w-[520px] md:rounded-[var(--radius-xl)]"
        >
          {/* First light (or last light) along the top of the panel. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-40"
            style={{
              background: isMorning
                ? "radial-gradient(120% 100% at 50% -30%, var(--atmos-a), transparent 70%)"
                : "radial-gradient(120% 100% at 50% -30%, var(--atmos-b), transparent 70%)",
            }}
          />

          {/* ── Header ─────────────────────────────────────────── */}
          <header className="relative shrink-0 px-6 pt-5 pb-5 md:pt-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[length:var(--text-ui)] font-medium text-[var(--text-3)]">
                  {isMorning ? (
                    <Sunrise
                      aria-hidden="true"
                      className="size-4 text-[var(--accent-text)]"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <Moon
                      aria-hidden="true"
                      className="size-4 text-[var(--status-someday)]"
                      strokeWidth={1.75}
                    />
                  )}
                  {isMorning ? "Morning planning" : "Evening review"}
                </span>
                {isMorning && (
                  <span className="flex items-center gap-2 text-[length:var(--text-meta)] text-[var(--text-3)] tabular-nums">
                    <span aria-hidden="true" className="flex gap-1">
                      {[0, 1, 2].map((s) => (
                        <span
                          key={s}
                          className={cn(
                            "h-1 w-5 rounded-full transition-colors duration-[var(--dur-slow)]",
                            s <= step
                              ? "bg-[var(--accent)]"
                              : "bg-[var(--surface-active)]",
                          )}
                        />
                      ))}
                    </span>
                    <span className="sr-only">Step </span>
                    {step + 1} of 3
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="-mr-2 flex size-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
              >
                <X aria-hidden="true" className="size-[18px]" />
              </button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={`${activeRitual}-${step}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2
                  id="ritual-title"
                  className="font-heading text-[length:var(--text-title-3xl)] leading-tight font-medium text-[var(--text-1)]"
                >
                  {heading}
                </h2>
                <p className="mt-1.5 text-[length:var(--text-body-lg)] text-[var(--text-3)]">
                  {guidance}
                </p>
              </m.div>
            </AnimatePresence>
          </header>

          {/* ── Body ──────────────────────────────────────────── */}
          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
            {loading ? (
              <div
                className="flex flex-col items-center justify-center gap-3 py-16"
                role="status"
              >
                <Loader2
                  aria-hidden="true"
                  className="size-6 animate-spin text-[var(--text-3)]"
                />
                <p className="text-[length:var(--text-body)] text-[var(--text-3)]">
                  Preparing your ritual…
                </p>
              </div>
            ) : isMorning ? (
              <AnimatePresence mode="wait" initial={false}>
                {step === 0 ? (
                  <m.div
                    key="step0"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{
                      opacity: 0,
                      x: -12,
                      transition: { duration: 0.12 },
                    }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-3"
                  >
                    <MindSweepPrompt
                      prompt="What's on your mind?"
                      placeholder="A task, a worry, an idea… Enter after each"
                      autoFocus
                      onCaptured={() => setSweptCount((n) => n + 1)}
                    />
                    <p className="px-1 text-[length:var(--text-meta)] text-[var(--text-3)]">
                      Each one is sorted and saved as you go. Nothing here is
                      required. Continue whenever your head feels clear.
                    </p>
                  </m.div>
                ) : step === 1 ? (
                  <m.div
                    key="step1"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{
                      opacity: 0,
                      x: -12,
                      transition: { duration: 0.12 },
                    }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {triageTasks.length === 0 ? (
                      <RitualEmpty icon={Check} title="Nothing to sort.">
                        Your inbox is clear and nothing is overdue.
                      </RitualEmpty>
                    ) : (
                      <RitualSection
                        title="Loose ends"
                        aside={`${triageTasks.length} to place`}
                      >
                        <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                          <AnimatePresence initial={false}>
                            {triageTasks.map((task) => (
                              <TriageRow
                                key={task.id}
                                task={task}
                                onAction={(id, action) => {
                                  haptics.selection();
                                  handleTriageAction(id, action);
                                }}
                              />
                            ))}
                          </AnimatePresence>
                        </ul>
                        <p className="hidden px-1 pt-1 text-[length:var(--text-meta)] text-[var(--text-3)] md:block">
                          Tip: press 1, 2 or 3 to place the top one.
                        </p>
                      </RitualSection>
                    )}
                  </m.div>
                ) : (
                  <m.div
                    key="step2"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-6"
                  >
                    {todayTasks.length === 0 ? (
                      <RitualEmpty
                        icon={Sun}
                        title="Nothing planned for today."
                      >
                        Nothing is set for today yet. Go back and choose
                        &ldquo;Today&rdquo; for anything that matters.
                      </RitualEmpty>
                    ) : (
                      <>
                        <RitualSection
                          title="Today"
                          aside={`${todayTasks.length} ${todayTasks.length === 1 ? "task" : "tasks"}`}
                        >
                          <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                            {todayTasks.map((task) => (
                              <li
                                key={task.id}
                                className="flex min-h-14 items-center gap-3 px-4 py-2"
                              >
                                <span
                                  aria-hidden="true"
                                  className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                                />
                                <p className="min-w-0 flex-1 truncate text-[length:var(--text-body-lg)] text-[var(--text-1)]">
                                  {task.title}
                                </p>
                                <label className="relative shrink-0">
                                  <span className="sr-only">
                                    Estimate for {task.title}, in minutes
                                  </span>
                                  {/* Shows the real saved value. It used to display
                                      25 for unestimated tasks while the total
                                      counted them as 0. */}
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="5"
                                    placeholder="—"
                                    value={task.time_estimate ?? ""}
                                    onChange={(e) =>
                                      handleEstimateChange(
                                        task.id,
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="input !h-9 !w-[4.75rem] !rounded-full !py-0 !pr-9 !pl-3 text-right !text-[length:var(--text-ui)] tabular-nums"
                                  />
                                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[length:var(--text-meta)] text-[var(--text-3)]">
                                    min
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </RitualSection>
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
              /* Evening */
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Finished today",
                      value: String(completedTasks.length),
                      unit: completedTasks.length === 1 ? "task" : "tasks",
                    },
                    {
                      label: "Focused for",
                      value: String(focusMinutes),
                      unit: "min",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3.5"
                    >
                      <p className="text-[length:var(--text-ui)] text-[var(--text-3)]">
                        {stat.label}
                      </p>
                      <p className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-heading text-[length:var(--text-title-3xl)] leading-none text-[var(--text-1)] tabular-nums">
                          {stat.value}
                        </span>
                        <span className="text-[length:var(--text-ui)] text-[var(--text-3)]">
                          {stat.unit}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>

                {completedTasks.length > 0 && (
                  <RitualSection title="Done">
                    <ul className="max-h-36 divide-y divide-[var(--border-subtle)] overflow-y-auto overscroll-contain rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                      {completedTasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <Check
                            aria-hidden="true"
                            className="size-4 shrink-0 text-[var(--status-done)]"
                            strokeWidth={2.25}
                          />
                          <p className="truncate text-[length:var(--text-body)] text-[var(--text-3)] line-through decoration-[var(--text-decorative)]">
                            {t.title}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </RitualSection>
                )}

                {triageTasks.length > 0 && (
                  <RitualSection
                    title="Still open"
                    aside={`${triageTasks.length} left`}
                  >
                    <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                      <AnimatePresence initial={false}>
                        {triageTasks.map((t) => (
                          <m.li
                            key={t.id}
                            layout
                            exit={{ opacity: 0, height: 0 }}
                            transition={{
                              duration: 0.22,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="flex items-center justify-between gap-3 overflow-hidden px-4 py-2"
                          >
                            <StillOpenRow
                              title={t.title}
                              onTomorrow={() => {
                                haptics.selection();
                                void handleCarryOver(t.id);
                              }}
                              onPickDay={(day) => {
                                haptics.selection();
                                void handleCarryOver(t.id, day);
                              }}
                              onDrop={() => {
                                haptics.selection();
                                void handleDrop(t.id);
                              }}
                            />
                          </m.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </RitualSection>
                )}

                {tomorrowTasks.length > 0 && (
                  <RitualSection title="Waiting for tomorrow">
                    <ul className="max-h-32 space-y-1 overflow-y-auto overscroll-contain px-1">
                      {tomorrowTasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-3 py-1">
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-[var(--text-decorative)]"
                          />
                          <p className="truncate text-[length:var(--text-body)] text-[var(--text-3)]">
                            {t.title}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </RitualSection>
                )}

                <RitualSection title="Anything else on your mind?">
                  <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                    {eveningPrompts.map((prompt) => (
                      <MindSweepPrompt key={prompt} prompt={prompt} />
                    ))}
                    <p className="text-[length:var(--text-meta)] text-[var(--text-3)]">
                      Skip any that don&apos;t apply. Whatever you add is sorted
                      and waiting for tomorrow&apos;s plan.
                    </p>
                  </div>
                </RitualSection>

                <div>
                  <label htmlFor="ritual-reflection" className="field-label">
                    One line about today
                  </label>
                  <TextareaAutosize
                    id="ritual-reflection"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="What went well? What's the one thing for tomorrow?"
                    minRows={3}
                    className="input resize-none leading-relaxed"
                  />
                  <p className="mt-1.5 text-[length:var(--text-meta)] text-[var(--text-3)]">
                    Saved to today&apos;s Daily Note in Think.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <footer className="relative flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:pb-4">
            {isMorning && step > 0 ? (
              <Button
                variant="ghost"
                onClick={() => setStep(step === 2 ? 1 : 0)}
                className="-ml-3"
              >
                <ChevronLeft aria-hidden="true" className="size-4" /> Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="-ml-3 text-[var(--text-3)]"
              >
                Skip for today
              </Button>
            )}

            {isMorning ? (
              step === 0 ? (
                <Button
                  variant="primary"
                  disabled={advancing}
                  onClick={() => void continueFromSweep()}
                  className="min-w-32"
                >
                  {advancing ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <>
                      Continue
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </>
                  )}
                </Button>
              ) : step === 1 ? (
                // Always available: anything left unplaced simply stays where
                // it is. It used to be disabled until the inbox was empty,
                // with no explanation, which left people stuck.
                <Button
                  variant="primary"
                  onClick={() => setStep(2)}
                  className="min-w-32"
                >
                  Continue
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={saving}
                  onClick={handleFinishMorning}
                  className="min-w-32"
                >
                  {saving ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    "Start my day"
                  )}
                </Button>
              )
            ) : (
              <Button
                variant="primary"
                disabled={saving}
                onClick={handleFinishEvening}
                className="min-w-32"
              >
                {saving ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  "Close the day"
                )}
              </Button>
            )}
          </footer>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}

export default RitualOverlay;
