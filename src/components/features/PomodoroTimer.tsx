"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient, safeMutate } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { X, Play, Pause, SkipForward, Square, Timer } from "lucide-react";
import { ConfirmModal } from "../ui/ConfirmModal";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Icon as UiIcon } from "@/components/ui/Icon";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import { completeTaskPatch } from "@/lib/item-lifecycle";

type Phase = "work" | "short_break" | "long_break";

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

const STORAGE_KEY = "pomodoro_state";

interface PersistedState {
  taskId: string | null;
  taskTitle: string | null;
  phase: Phase;
  sessionCount: number;
  startedAt: number;
  duration: number;
}

function saveTimerState(state: PersistedState | null) {
  if (state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadTimerState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function PomodoroTimer() {
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

  const [phase, setPhase] = useState<Phase>("work");
  const [sessionCount, setSessionCount] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const startedAtRef = useRef<number>(0);
  const didInitRef = useRef(false);

  const workDuration = (userSettings?.pomodoro_duration || 25) * 60;
  const shortBreakDuration = (userSettings?.short_break_duration || 5) * 60;
  const longBreakDuration = (userSettings?.long_break_duration || 15) * 60;
  const longBreakInterval = userSettings?.pomodoro_long_break_interval || 4;
  const autoStartBreaks = userSettings?.auto_start_breaks || false;

  const getDuration = useCallback(
    (p: Phase) => {
      if (p === "short_break") return shortBreakDuration;
      if (p === "long_break") return longBreakDuration;
      return workDuration;
    },
    [workDuration, shortBreakDuration, longBreakDuration],
  );

  const logSession = useCallback(
    async (type: Phase, minutes: number) => {
      if (!activeTimer || minutes < 1) return;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await safeMutate(
          () =>
            supabase.from("session_logs").insert({
              user_id: user.id,
              task_id: activeTimer.taskId || null,
              duration_minutes: minutes,
              type,
            }),
          "Failed to log session",
        );
      } catch {}
    },
    [activeTimer, supabase],
  );

  const advance = useCallback(() => {
    if (phase === "work") {
      const nextPhase =
        sessionCount % longBreakInterval === 0 ? "long_break" : "short_break";
      const d = getDuration(nextPhase);
      setPhase(nextPhase);
      setSessionCount(sessionCount);
      setDuration(d);
      setDisplayTime(d);
      startedAtRef.current = Date.now();
      // nextPhase is always a break phase here, so auto-start breaks if enabled
      const shouldAutoStart = autoStartBreaks;
      setIsRunning(shouldAutoStart);
      saveTimerState({
        taskId: activeTimer?.taskId || null,
        taskTitle: activeTimer?.taskTitle || null,
        phase: nextPhase,
        sessionCount: sessionCount,
        startedAt: startedAtRef.current,
        duration: d,
      });
    } else if (phase === "long_break") {
      const d = getDuration("work");
      setPhase("work");
      setSessionCount(1);
      setDuration(d);
      setDisplayTime(d);
      startedAtRef.current = Date.now();
      setIsRunning(false);
      saveTimerState({
        taskId: activeTimer?.taskId || null,
        taskTitle: activeTimer?.taskTitle || null,
        phase: "work",
        sessionCount: 1,
        startedAt: startedAtRef.current,
        duration: d,
      });
    } else {
      const d = getDuration("work");
      setPhase("work");
      setSessionCount(sessionCount + 1);
      setDuration(d);
      setDisplayTime(d);
      startedAtRef.current = Date.now();
      setIsRunning(false);
      saveTimerState({
        taskId: activeTimer?.taskId || null,
        taskTitle: activeTimer?.taskTitle || null,
        phase: "work",
        sessionCount: sessionCount + 1,
        startedAt: startedAtRef.current,
        duration: d,
      });
    }
  }, [
    phase,
    sessionCount,
    longBreakInterval,
    getDuration,
    autoStartBreaks,
    activeTimer,
  ]);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    saveTimerState(null);
    if (userSettings?.pomodoro_sound !== false) {
      new Audio("/notification.mp3").play().catch(() => {});
    }

    if (phase === "work" && activeTimer) {
      toast.success(
        `Session complete! Did you finish '${activeTimer.taskTitle}'?`,
        {
          duration: 8000,
          icon: (
            <UiIcon className="h-4 w-4 text-[var(--accent)]" icon={Timer} />
          ),
          action: {
            label: "Mark Done",
            onClick: async () => {
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
              setActiveTimer(null);
            },
          },
        },
      );
    }

    logSession(phase, Math.round(duration / 60));
    advance();
  }, [
    phase,
    duration,
    logSession,
    advance,
    userSettings,
    activeTimer,
    markMutation,
    supabase,
    queryClient,
    setActiveTimer,
  ]);

  const startPhase = useCallback(
    (p: Phase, count: number, autoStart: boolean) => {
      const d = getDuration(p);
      setPhase(p);
      setSessionCount(count);
      setDuration(d);
      setDisplayTime(d);
      startedAtRef.current = Date.now();
      setIsRunning(autoStart);
      saveTimerState({
        taskId: activeTimer?.taskId || null,
        taskTitle: activeTimer?.taskTitle || null,
        phase: p,
        sessionCount: count,
        startedAt: startedAtRef.current,
        duration: d,
      });
    },
    [getDuration, activeTimer],
  );

  // Restore from localStorage on mount — intentional sync initialization
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (activeTimer) {
      const saved = loadTimerState();
      if (saved && saved.taskId === activeTimer.taskId) {
        const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
        const remaining = Math.max(0, saved.duration - elapsed);
        setPhase(saved.phase);
        setSessionCount(saved.sessionCount);
        setDuration(saved.duration);
        setDisplayTime(remaining);
        startedAtRef.current = saved.startedAt;
        setIsRunning(remaining > 0);
        didInitRef.current = true;
      } else {
        startPhase("work", 1, true);
        didInitRef.current = true;
      }
    }
  }, [activeTimer?.taskId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Phase change → reset timer — intentional sync initialization
  // Skipped on first run if restore effect already handled initialization
  useEffect(() => {
    if (!activeTimer) return;
    if (didInitRef.current) {
      didInitRef.current = false;
      return;
    }
    const d = getDuration(phase);
    setDuration(d);
    setDisplayTime(d);
    startedAtRef.current = Date.now();
    const shouldAutoStart = phase !== "work" ? autoStartBreaks : false;
    setIsRunning(shouldAutoStart);
    saveTimerState({
      taskId: activeTimer?.taskId || null,
      taskTitle: activeTimer?.taskTitle || null,
      phase,
      sessionCount,
      startedAt: startedAtRef.current,
      duration: d,
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Persist state on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && activeTimer) {
        saveTimerState({
          taskId: activeTimer.taskId || null,
          taskTitle: activeTimer.taskTitle || null,
          phase,
          sessionCount,
          startedAt: startedAtRef.current,
          duration,
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeTimer, phase, sessionCount, duration]);

  const handleSkip = () => {
    const spent = duration - displayTime;
    if (spent > 60) logSession(phase, Math.round(spent / 60));
    advance();
  };

  const handleEnd = () => {
    const spent = duration - displayTime;
    if (spent > 60 && phase === "work")
      logSession(phase, Math.round(spent / 60));
    setShowConfirmEnd(false);
    saveTimerState(null);
    setActiveTimer(null);
  };

  if (!activeTimer) return null;

  const mins = Math.floor(displayTime / 60)
    .toString()
    .padStart(2, "0");
  const s = (displayTime % 60).toString().padStart(2, "0");
  const r = 90;
  const circ = 2 * Math.PI * r;
  const progress = duration > 0 ? displayTime / duration : 1;
  const dashoffset = circ * (1 - progress);

  const cfg = PHASE_CONFIG[phase];

  return (
    <AnimatePresence>
      <m.div
        key="pomodoro-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
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

        {/* Close button */}
        <button
          onClick={() => setShowConfirmEnd(true)}
          className="absolute top-6 right-6 z-10 rounded-full p-2 text-[var(--text-3)] transition-colors hover:bg-white/10 hover:text-[var(--text-1)]"
        >
          <UiIcon size={18} strokeWidth={1.5} icon={X} />
        </button>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-0">
          {/* Phase label */}
          <p
            className="text-caption mb-1 font-semibold tracking-[0.18em] uppercase"
            style={{ color: "var(--text-3)" }}
          >
            {phase === "work"
              ? "Work Session"
              : phase === "short_break"
                ? "Short Break"
                : "Long Break"}
          </p>
          <p className="text-ui mb-10" style={{ color: "var(--text-3)" }}>
            {phase === "work"
              ? `${sessionCount} of ${longBreakInterval}`
              : "Take a breather"}
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
                stroke="rgba(255,255,255,0.06)"
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
                {mins}:{s}
              </span>
            </div>
          </div>

          {/* Task title */}
          <h2
            className="text-body-lg mb-12 max-w-[260px] truncate text-center font-medium"
            style={{ color: "var(--text-2)" }}
          >
            {activeTimer.taskTitle || "Focus Session"}
          </h2>

          {/* Controls */}
          <div className="flex items-center gap-5">
            <button
              onClick={() => setShowConfirmEnd(true)}
              aria-label="End session"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-all",
                "border border-white/10 bg-white/5 text-[var(--text-3)]",
                "hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-400",
              )}
              title="End session"
            >
              <UiIcon size={16} strokeWidth={1.5} icon={Square} />
            </button>

            <button
              onClick={() => {
                if (isRunning) {
                  setIsRunning(false);
                  saveTimerState({
                    taskId: activeTimer?.taskId || null,
                    taskTitle: activeTimer?.taskTitle || null,
                    phase,
                    sessionCount,
                    startedAt: startedAtRef.current,
                    duration,
                  });
                } else {
                  const elapsed = duration - displayTime;
                  startedAtRef.current = Date.now() - elapsed * 1000;
                  setIsRunning(true);
                }
              }}
              aria-label={isRunning ? "Pause" : "Play"}
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: cfg.ring }}
              title={isRunning ? "Pause" : "Play"}
            >
              {isRunning ? (
                <UiIcon
                  size={20}
                  strokeWidth={0}
                  className="fill-black"
                  icon={Pause}
                />
              ) : (
                <UiIcon
                  size={20}
                  strokeWidth={0}
                  className="ml-0.5 fill-black"
                  icon={Play}
                />
              )}
            </button>

            <button
              onClick={handleSkip}
              aria-label="Skip phase"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-all",
                "border border-white/10 bg-white/5 text-[var(--text-3)]",
                "hover:bg-white/10 hover:text-[var(--text-1)]",
              )}
              title="Skip"
            >
              <UiIcon size={16} strokeWidth={1.5} icon={SkipForward} />
            </button>
          </div>
        </div>

        <ConfirmModal
          isOpen={showConfirmEnd}
          onClose={() => setShowConfirmEnd(false)}
          onConfirm={handleEnd}
          title={phase === "work" ? "End focus session?" : "End break early?"}
          description={
            phase === "work"
              ? duration - displayTime > 60
                ? `If you end now, ${Math.round((duration - displayTime) / 60)} minutes will be saved.`
                : "This session is too short to be saved."
              : "This will close the timer."
          }
          confirmLabel={phase === "work" ? "End Session" : "Close Timer"}
        />
      </m.div>
    </AnimatePresence>
  );
}
