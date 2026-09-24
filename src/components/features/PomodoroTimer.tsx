"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useUserId } from "@/components/providers/SessionProvider";
import { createClient, safeMutate } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import {
  ArrowRight,
  Check,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipForward,
  Square,
  Timer,
  X,
} from "lucide-react";
import { ConfirmModal } from "../ui/ConfirmModal";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Icon as UiIcon } from "@/components/ui/Icon";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import { completeTaskPatch } from "@/lib/item-lifecycle";
import { playChime } from "@/lib/chime";
import {
  loadFocusTimer,
  remainingSeconds,
  saveFocusTimer,
  startLengths,
  type FocusTimerState,
  type Phase,
} from "@/lib/focus-timer";

const PHASE_CONFIG: Record<
  Phase,
  { label: string; orb: string; ring: string; text: string }
> = {
  work: {
    label: "Work Session",
    orb: "rgba(251,191,36,0.18)",
    ring: "var(--color-accent)",
    text: "var(--color-accent)",
  },
  short_break: {
    label: "Short Break",
    orb: "rgba(45,212,191,0.15)",
    ring: "#2DD4BF",
    text: "#2DD4BF",
  },
  long_break: {
    label: "Long Break",
    orb: "rgba(129,140,248,0.15)",
    ring: "#818CF8",
    text: "#818CF8",
  },
};

// The overlay's fade-in; initial focus waits for it so the handoff from
// whatever opened the timer (e.g. the mobile drawer closing) settles first.
const OVERLAY_FADE_MS = 350;

/**
 * ready  – nothing is counting yet: the task, its first step, a length to
 *          pick. The timer only starts when the user presses Start.
 * active – a phase is running or paused.
 * done   – a short start finished: keep going, or stop there.
 */
type Stage = "ready" | "active" | "done";

const fmt = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

export function PomodoroTimer() {
  const userId = useUserId();
  const { activeTimer, setActiveTimer, userSettings, markMutation } =
    useAppStore(
      useShallow((s) => ({
        activeTimer: s.activeTimer,
        setActiveTimer: s.setActiveTimer,
        userSettings: s.userSettings,
        markMutation: s.markMutation,
      })),
    );
  const supabase = createClient();
  const queryClient = useQueryClient();

  const workMinutes = userSettings?.pomodoro_duration || 25;
  const workDuration = workMinutes * 60;
  const shortBreakDuration = (userSettings?.short_break_duration || 5) * 60;
  const longBreakDuration = (userSettings?.long_break_duration || 15) * 60;
  const longBreakInterval = userSettings?.pomodoro_long_break_interval || 4;
  const autoStartBreaks = userSettings?.auto_start_breaks || false;

  const [stage, setStage] = useState<Stage>("ready");
  const [phase, setPhase] = useState<Phase>("work");
  const [sessionCount, setSessionCount] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [shortStart, setShortStart] = useState(false);
  const [lastFocusMinutes, setLastFocusMinutes] = useState(0);
  const [chosenMinutes, setChosenMinutes] = useState(workMinutes);
  const [firstStepDraft, setFirstStepDraft] = useState("");
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  const startedAtRef = useRef<number>(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const initialFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const confirmReturnFocusRef = useRef<HTMLElement | null>(null);

  const taskId = activeTimer?.taskId ?? null;
  const firstStep = activeTimer?.firstStep?.trim() || "";

  const getDuration = useCallback(
    (p: Phase) => {
      if (p === "short_break") return shortBreakDuration;
      if (p === "long_break") return longBreakDuration;
      return workDuration;
    },
    [workDuration, shortBreakDuration, longBreakDuration],
  );

  /** Saves the phase as given; every transition passes its new values. */
  const persist = useCallback(
    (state: Omit<FocusTimerState, "taskId" | "taskTitle" | "firstStep">) => {
      saveFocusTimer({
        taskId,
        taskTitle: activeTimer?.taskTitle ?? null,
        firstStep: activeTimer?.firstStep ?? null,
        ...state,
      });
    },
    [taskId, activeTimer?.taskTitle, activeTimer?.firstStep],
  );

  const logSession = useCallback(
    async (type: Phase, minutes: number) => {
      if (!activeTimer || minutes < 1) return;
      try {
        const { success } = await safeMutate(
          () =>
            supabase.from("session_logs").insert({
              user_id: userId,
              task_id: activeTimer.taskId || null,
              duration_minutes: minutes,
              type,
            }),
          "Failed to log session",
        );
        // A trigger adds work minutes to the task's time spent; refresh the
        // lists so the new total shows without waiting for a refetch.
        if (success && type === "work") {
          for (const queryKey of [["tasks"], ["dashboard"]]) {
            void queryClient.invalidateQueries(
              { queryKey },
              { cancelRefetch: false },
            );
          }
        }
      } catch {}
    },
    [activeTimer, supabase, userId, queryClient],
  );

  const runPhase = useCallback(
    (
      p: Phase,
      count: number,
      seconds: number,
      opts: { running: boolean; short?: boolean },
    ) => {
      startedAtRef.current = Date.now();
      setStage("active");
      setPhase(p);
      setSessionCount(count);
      setDuration(seconds);
      setDisplayTime(seconds);
      setIsRunning(opts.running);
      setShortStart(Boolean(opts.short));
      // Every new phase (start, keep going, break, next session) is shown
      // in full, including one that begins while the pill was showing.
      setMinimized(false);
      persist({
        phase: p,
        sessionCount: count,
        startedAt: startedAtRef.current,
        duration: seconds,
        pausedRemaining: opts.running ? null : seconds,
        minimized: false,
        shortStart: Boolean(opts.short),
      });
    },
    [persist],
  );

  const advance = useCallback(() => {
    if (phase === "work") {
      const next =
        sessionCount % longBreakInterval === 0 ? "long_break" : "short_break";
      runPhase(next, sessionCount, getDuration(next), {
        running: autoStartBreaks,
      });
    } else if (phase === "long_break") {
      runPhase("work", 1, workDuration, { running: false });
    } else {
      runPhase("work", sessionCount + 1, workDuration, { running: false });
    }
  }, [
    phase,
    sessionCount,
    longBreakInterval,
    getDuration,
    autoStartBreaks,
    workDuration,
    runPhase,
  ]);

  const markTaskDone = useCallback(async () => {
    if (!activeTimer?.taskId) return;
    markMutation();
    const { success } = await safeMutate(
      () =>
        supabase
          .from("items")
          .update(completeTaskPatch())
          .eq("id", activeTimer.taskId as string),
      "Failed to mark task done",
    );
    if (!success) return;
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    saveFocusTimer(null);
    setActiveTimer(null);
  }, [activeTimer, markMutation, supabase, queryClient, setActiveTimer]);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    // Time's up needs attention: bring the full view back if minimised.
    setMinimized(false);
    if (userSettings?.pomodoro_sound !== false) playChime();
    logSession(phase, Math.round(duration / 60));

    if (phase === "work" && shortStart) {
      // A short start ends on a choice, not a break.
      setLastFocusMinutes(Math.round(duration / 60));
      setStage("done");
      saveFocusTimer(null);
      return;
    }

    if (phase === "work" && activeTimer?.taskId) {
      toast.success(
        `Session complete! Did you finish '${activeTimer.taskTitle}'?`,
        {
          duration: 8000,
          icon: (
            <UiIcon className="h-4 w-4 text-[var(--accent)]" icon={Timer} />
          ),
          action: { label: "Mark Done", onClick: () => void markTaskDone() },
        },
      );
    }
    advance();
  }, [
    phase,
    duration,
    shortStart,
    logSession,
    advance,
    userSettings,
    activeTimer,
    markTaskDone,
  ]);

  // Open: resume a saved session for this task, otherwise wait on "ready".
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!activeTimer) return;
    const saved = loadFocusTimer();
    if (saved && saved.taskId === (activeTimer.taskId ?? null)) {
      const remaining = remainingSeconds(saved);
      startedAtRef.current = Date.now() - (saved.duration - remaining) * 1000;
      setStage("active");
      setPhase(saved.phase);
      setSessionCount(saved.sessionCount);
      setDuration(saved.duration);
      setDisplayTime(remaining);
      // A running phase that ended while away completes on the next tick.
      setIsRunning(saved.pausedRemaining == null);
      setMinimized(Boolean(saved.minimized));
      setShortStart(Boolean(saved.shortStart));
    } else {
      setStage("ready");
      setMinimized(false);
    }
  }, [activeTimer?.taskId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Wall-clock countdown — immune to tab throttling
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setDisplayTime(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleComplete();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isRunning, duration, handleComplete]);

  const saveFirstStep = useCallback(
    async (text: string) => {
      if (!activeTimer?.taskId) return;
      setActiveTimer({ ...activeTimer, firstStep: text });
      markMutation();
      const { success } = await safeMutate(
        () =>
          supabase
            .from("items")
            .update({ first_step: text })
            .eq("id", activeTimer.taskId as string),
        "Couldn't save the first step",
      );
      if (success) {
        void queryClient.invalidateQueries(
          { queryKey: ["tasks"] },
          { cancelRefetch: false },
        );
      }
    },
    [activeTimer, setActiveTimer, markMutation, supabase, queryClient],
  );

  const start = () => {
    const draft = firstStepDraft.trim();
    if (draft && !firstStep) void saveFirstStep(draft);
    runPhase("work", sessionCount, chosenMinutes * 60, {
      running: true,
      short: chosenMinutes < workMinutes,
    });
  };

  const togglePause = () => {
    if (isRunning) {
      setIsRunning(false);
      persist({
        phase,
        sessionCount,
        startedAt: startedAtRef.current,
        duration,
        pausedRemaining: displayTime,
        minimized,
        shortStart,
      });
    } else {
      startedAtRef.current = Date.now() - (duration - displayTime) * 1000;
      setIsRunning(true);
      persist({
        phase,
        sessionCount,
        startedAt: startedAtRef.current,
        duration,
        pausedRemaining: null,
        minimized,
        shortStart,
      });
    }
  };

  const setMinimizedAndSave = (value: boolean) => {
    setMinimized(value);
    persist({
      phase,
      sessionCount,
      startedAt: startedAtRef.current,
      duration,
      pausedRemaining: isRunning ? null : displayTime,
      minimized: value,
      shortStart,
    });
  };

  const close = useCallback(() => {
    setShowConfirmEnd(false);
    saveFocusTimer(null);
    setActiveTimer(null);
  }, [setActiveTimer]);

  // Opening the confirm hands focus to Radix: cancel any pending initial
  // focus so it can't pull focus back out of the confirm, and remember the
  // control to return to once the confirm closes.
  const openConfirmEnd = useCallback(() => {
    if (initialFocusTimerRef.current) {
      clearTimeout(initialFocusTimerRef.current);
      initialFocusTimerRef.current = null;
    }
    const active = document.activeElement;
    confirmReturnFocusRef.current =
      active instanceof HTMLElement && overlayRef.current?.contains(active)
        ? active
        : null;
    setShowConfirmEnd(true);
  }, []);

  /** X / Escape: nothing to lose before a session starts or after it ends. */
  const requestClose = useCallback(() => {
    if (stage === "active") openConfirmEnd();
    else close();
  }, [stage, openConfirmEnd, close]);

  // The full view is modal: move focus onto its primary control once it has
  // faded in (and again when the stage changes), unless the user already
  // put focus inside it.
  const showOverlay = activeTimer !== null && !minimized;
  useEffect(() => {
    if (!showOverlay) return;
    initialFocusTimerRef.current = setTimeout(() => {
      initialFocusTimerRef.current = null;
      if (!overlayRef.current?.contains(document.activeElement)) {
        primaryRef.current?.focus();
      }
    }, OVERLAY_FADE_MS);
    return () => {
      if (initialFocusTimerRef.current) {
        clearTimeout(initialFocusTimerRef.current);
        initialFocusTimerRef.current = null;
      }
    };
  }, [showOverlay, stage]);

  // Escape: closes before a session starts; once one is running it opens the
  // same confirm as the X / End buttons (ending should be confirmed). When
  // the confirm is already open, its own Radix Escape handler closes it.
  useEffect(() => {
    if (!showOverlay) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showConfirmEnd) requestClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showOverlay, showConfirmEnd, requestClose]);

  // Keep Tab inside the overlay. The confirm is portalled out of this DOM
  // subtree (its React events still bubble here), and Radix traps it.
  const handleOverlayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (e.key !== "Tab" || !overlay || !overlay.contains(e.target as Node)) {
      return;
    }
    const focusable = overlay.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled])",
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleConfirmCloseAutoFocus = (event: Event) => {
    const target = confirmReturnFocusRef.current ?? primaryRef.current;
    confirmReturnFocusRef.current = null;
    if (!target?.isConnected) return;
    event.preventDefault();
    target.focus();
  };

  const handleSkip = () => {
    const spent = duration - displayTime;
    if (spent > 60) logSession(phase, Math.round(spent / 60));
    advance();
  };

  const handleEnd = () => {
    const spent = duration - displayTime;
    if (spent > 60 && phase === "work")
      logSession(phase, Math.round(spent / 60));
    close();
  };

  if (!activeTimer) return null;

  const cfg = PHASE_CONFIG[phase];
  const title = activeTimer.taskTitle || "Focus Session";
  const spentSeconds = duration - displayTime;

  if (minimized && stage === "active") {
    return (
      <div
        role="region"
        aria-label="Focus timer"
        className="fixed right-4 bottom-[calc(var(--mobile-bottom-nav-h)+env(safe-area-inset-bottom,0px)+var(--space-3))] z-[95] flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--surface-1)] py-1 pr-1 pl-1 shadow-[var(--shadow-lg)] md:right-6 md:bottom-6"
      >
        <button
          type="button"
          onClick={() => setMinimizedAndSave(false)}
          aria-label={`Open focus timer: ${title}`}
          className="flex min-w-0 items-center gap-2.5 rounded-full py-1.5 pr-2 pl-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 shrink-0 rounded-full",
              isRunning && "animate-pulse motion-reduce:animate-none",
            )}
            style={{ background: cfg.ring }}
          />
          <span className="max-w-[9rem] truncate text-[length:var(--text-ui)] text-[var(--text-2)]">
            {phase === "work" ? title : cfg.label}
          </span>
          <span
            className="font-mono text-[length:var(--text-ui)] font-medium tabular-nums"
            style={{ color: cfg.text }}
          >
            {fmt(displayTime)}
          </span>
          <UiIcon
            className="h-3.5 w-3.5 shrink-0 text-[var(--text-3)]"
            icon={Maximize2}
          />
        </button>
        <button
          type="button"
          onClick={togglePause}
          aria-label={isRunning ? "Pause" : "Play"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full transition hover:scale-105 active:scale-95"
          style={{ background: cfg.ring }}
        >
          <UiIcon
            size={14}
            strokeWidth={0}
            fill="black"
            className={isRunning ? undefined : "ml-0.5"}
            icon={isRunning ? Pause : Play}
          />
        </button>
      </div>
    );
  }

  const r = 90;
  const circ = 2 * Math.PI * r;
  const progress = duration > 0 ? displayTime / duration : 1;
  const dashoffset = circ * (1 - progress);

  const FirstStep = firstStep ? (
    <p className="text-ui flex max-w-[300px] items-start gap-1.5 text-left text-[var(--text-2)]">
      <UiIcon
        size={14}
        className="mt-0.5 shrink-0 text-[var(--accent-text)]"
        icon={ArrowRight}
      />
      <span>
        <span className="text-[var(--text-3)]">First step: </span>
        {firstStep}
      </span>
    </p>
  ) : null;

  return (
    <AnimatePresence>
      <m.div
        key="pomodoro-overlay"
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Focus session"
        onKeyDown={handleOverlayKeyDown}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: OVERLAY_FADE_MS / 1000,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden px-6"
        style={{
          background: "rgba(8, 6, 16, 0.92)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Atmospheric orb */}
        <m.div
          key={phase}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="pointer-events-none absolute"
          style={{
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${cfg.orb} 0%, transparent 70%)`,
            filter: "blur(60px)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Close button (first in the tab order) */}
        <button
          onClick={requestClose}
          aria-label="Close focus session"
          className="absolute top-6 right-6 z-10 rounded-full p-2 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
        >
          <UiIcon size={18} strokeWidth={1.5} icon={X} />
        </button>
        {stage === "active" && (
          <button
            onClick={() => setMinimizedAndSave(true)}
            aria-label="Minimise timer"
            title="Minimise — keep the timer while you use the app"
            className="absolute top-6 right-16 z-10 rounded-full p-2 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
          >
            <UiIcon size={18} strokeWidth={1.5} icon={Minimize2} />
          </button>
        )}

        {stage === "ready" && (
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 text-center">
            <p className="text-caption font-semibold tracking-[0.18em] text-[var(--text-3)] uppercase">
              Ready when you are
            </p>
            <h2 className="text-title-sm font-medium text-[var(--text-1)]">
              {title}
            </h2>
            {FirstStep ??
              (taskId && (
                <label className="flex w-full flex-col gap-1.5 text-left">
                  <span className="text-ui text-[var(--text-3)]">
                    Smallest first step (optional)
                  </span>
                  <input
                    value={firstStepDraft}
                    onChange={(e) => setFirstStepDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        start();
                      }
                    }}
                    placeholder="e.g. open the doc and write the heading"
                    maxLength={500}
                    className="text-ui rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-1)] outline-none placeholder:text-[var(--text-decorative)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                  />
                </label>
              ))}

            <div
              role="radiogroup"
              aria-label="Session length"
              className="flex flex-wrap justify-center gap-2"
            >
              {startLengths(workMinutes).map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  role="radio"
                  aria-checked={chosenMinutes === minutes}
                  onClick={() => setChosenMinutes(minutes)}
                  className={cn(
                    "text-ui h-9 rounded-full border px-4 font-medium transition-colors",
                    chosenMinutes === minutes
                      ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]"
                      : "border-[var(--border-default)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>

            <button
              ref={primaryRef}
              type="button"
              onClick={start}
              className="flex h-12 items-center gap-2 rounded-full px-7 font-semibold text-black shadow-lg transition hover:scale-[1.03] active:scale-95"
              style={{ background: cfg.ring }}
            >
              <UiIcon size={16} strokeWidth={0} fill="black" icon={Play} />
              Start · {chosenMinutes} min
            </button>
            <p className="text-ui text-[var(--text-3)]">
              {chosenMinutes < workMinutes
                ? "Just this long. Stop or keep going when it ends."
                : "A full session, then a break."}
            </p>
          </div>
        )}

        {stage === "done" && (
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--status-done-dim)] text-[var(--status-done)]">
              <UiIcon size={22} icon={Check} />
            </span>
            <h2 className="text-title-sm font-medium text-[var(--text-1)]">
              Nice start.
            </h2>
            <p className="text-body text-[var(--text-2)]">
              {lastFocusMinutes} min on {title}. Keep going, or stop here;
              either way it counts.
            </p>
            <div className="flex w-full flex-col gap-2">
              <button
                ref={primaryRef}
                type="button"
                onClick={() =>
                  runPhase("work", sessionCount, workDuration, {
                    running: true,
                  })
                }
                className="h-11 rounded-full font-semibold text-black transition hover:scale-[1.02] active:scale-95"
                style={{ background: cfg.ring }}
              >
                Keep going · {workMinutes} min
              </button>
              {taskId && (
                <button
                  type="button"
                  onClick={() => void markTaskDone()}
                  className="text-ui h-11 rounded-full border border-[var(--border-default)] font-medium text-[var(--text-1)] hover:bg-[var(--surface-hover)]"
                >
                  Mark task done
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="text-ui h-11 rounded-full font-medium text-[var(--text-2)] hover:bg-[var(--surface-hover)]"
              >
                Done for now
              </button>
            </div>
          </div>
        )}

        {stage === "active" && (
          <div className="relative z-10 flex flex-col items-center gap-0">
            {/* Phase label */}
            <p
              className="text-caption mb-1 font-semibold tracking-[0.18em] uppercase"
              style={{ color: "var(--text-3)" }}
            >
              {phase === "work"
                ? shortStart
                  ? "Short start"
                  : "Work Session"
                : phase === "short_break"
                  ? "Short Break"
                  : "Long Break"}
            </p>
            <p className="text-ui mb-10" style={{ color: "var(--text-3)" }}>
              {phase !== "work"
                ? "Take a breather"
                : shortStart
                  ? "Just this long"
                  : `${sessionCount} of ${longBreakInterval}`}
            </p>

            {/* SVG Ring + Timer */}
            <div
              className="relative mb-10 flex items-center justify-center"
              style={{ width: 220, height: 220 }}
            >
              <svg
                width="220"
                height="220"
                viewBox="0 0 220 220"
                className="absolute inset-0 -rotate-90"
              >
                <circle
                  cx="110"
                  cy="110"
                  r={r}
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth="6"
                />
                <circle
                  cx="110"
                  cy="110"
                  r={r}
                  fill="none"
                  stroke={cfg.ring}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={dashoffset}
                  style={{ transition: "stroke-dashoffset 0.9s linear" }}
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span
                  style={{
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 48,
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    color: cfg.text,
                  }}
                >
                  {fmt(displayTime)}
                </span>
                {!isRunning && (
                  <span className="text-caption mt-2 tracking-[0.18em] text-[var(--text-3)] uppercase">
                    Paused
                  </span>
                )}
              </div>
            </div>

            {/* Task title and first step */}
            <h2
              className={cn(
                "text-body-lg max-w-[280px] truncate text-center font-medium",
                phase === "work" && FirstStep ? "mb-3" : "mb-12",
              )}
              style={{ color: "var(--text-2)" }}
            >
              {title}
            </h2>
            {phase === "work" && FirstStep && (
              <div className="mb-10">{FirstStep}</div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-5">
              <button
                onClick={openConfirmEnd}
                aria-label="End session"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition",
                  "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-3)]",
                  "hover:border-[var(--status-danger-border)] hover:bg-[var(--status-danger-dim)] hover:text-[var(--status-danger)]",
                )}
                title="End session"
              >
                <UiIcon size={16} strokeWidth={1.5} icon={Square} />
              </button>

              <button
                ref={primaryRef}
                onClick={togglePause}
                aria-label={isRunning ? "Pause" : "Play"}
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95"
                style={{ background: cfg.ring }}
                title={isRunning ? "Pause" : "Play"}
              >
                {isRunning ? (
                  <UiIcon size={20} strokeWidth={0} fill="black" icon={Pause} />
                ) : (
                  <UiIcon
                    size={20}
                    strokeWidth={0}
                    fill="black"
                    className="ml-0.5"
                    icon={Play}
                  />
                )}
              </button>

              <button
                onClick={handleSkip}
                aria-label="Skip phase"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition",
                  "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-3)]",
                  "hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]",
                )}
                title="Skip"
              >
                <UiIcon size={16} strokeWidth={1.5} icon={SkipForward} />
              </button>
            </div>
          </div>
        )}

        {/*
          The Pomodoro overlay renders at z-[200], above the shared Dialog
          system's default z-50 — without this override the confirm dialog
          would be mounted but invisible/unclickable underneath the opaque
          backdrop above, leaving no way to exit an active session short of
          a page refresh. z-[250] keeps it above the overlay's own z-10
          content layer too.

          Click-outside is intentionally left at Radix's default (dismiss the
          confirm, not the session) rather than disabled — accidentally
          closing this confirmation is low-cost since it doesn't end the
          timer by itself; only "End Session" does that.
        */}
        <ConfirmModal
          isOpen={showConfirmEnd}
          onClose={() => setShowConfirmEnd(false)}
          onConfirm={handleEnd}
          title={phase === "work" ? "End focus session?" : "End break early?"}
          description={
            phase === "work"
              ? spentSeconds > 60
                ? `If you end now, ${Math.round(spentSeconds / 60)} minutes will be saved.`
                : "This session is too short to be saved."
              : "This will close the timer."
          }
          confirmLabel={phase === "work" ? "End Session" : "Close Timer"}
          zIndexClassName="z-[250]"
          onCloseAutoFocus={handleConfirmCloseAutoFocus}
        />
      </m.div>
    </AnimatePresence>
  );
}
