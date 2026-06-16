"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { X, Play, Pause, SkipForward, Square } from "lucide-react";
import { ConfirmModal } from "../ui/ConfirmModal";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Phase = "work" | "short_break" | "long_break";

const PHASE_CONFIG: Record<Phase, { label: string; orb: string; ring: string; text: string }> = {
  work:        { label: "Work Session",   orb: "rgba(251,191,36,0.18)",  ring: "var(--color-accent)",  text: "var(--color-accent)" },
  short_break: { label: "Short Break",    orb: "rgba(45,212,191,0.15)",  ring: "#2DD4BF",              text: "#2DD4BF" },
  long_break:  { label: "Long Break",     orb: "rgba(129,140,248,0.15)", ring: "#818CF8",              text: "#818CF8" },
};

export function PomodoroTimer() {
  const { activeTimer, setActiveTimer, userSettings } = useAppStore();
  const supabase = createClient();

  const [phase, setPhase]               = useState<Phase>("work");
  const [sessionCount, setSessionCount] = useState(1);
  const [timeLeft, setTimeLeft]         = useState(0);
  const [totalTime, setTotalTime]       = useState(0);
  const [isRunning, setIsRunning]       = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  const workDuration      = (userSettings?.pomodoro_duration       || 25) * 60;
  const shortBreakDuration = (userSettings?.short_break_duration   ||  5) * 60;
  const longBreakDuration  = (userSettings?.long_break_duration    || 15) * 60;
  const longBreakInterval  =  userSettings?.pomodoro_long_break_interval || 4;
  const autoStartBreaks    =  userSettings?.auto_start_breaks      || false;

  const getDuration = useCallback((p: Phase) => {
    if (p === "short_break") return shortBreakDuration;
    if (p === "long_break")  return longBreakDuration;
    return workDuration;
  }, [workDuration, shortBreakDuration, longBreakDuration]);

  // Initialize when opened
  useEffect(() => {
    if (activeTimer) {
      const d = getDuration("work");
      setPhase("work");
      setSessionCount(1);
      setTimeLeft(d);
      setTotalTime(d);
      setIsRunning(true);
    }
  }, [activeTimer?.taskId]); // eslint-disable-line

  // Phase change → reset timer
  useEffect(() => {
    const d = getDuration(phase);
    setTimeLeft(d);
    setTotalTime(d);
    const shouldAutoStart = phase !== "work" ? autoStartBreaks : false;
    setIsRunning(shouldAutoStart);
  }, [phase]); // eslint-disable-line

  // Countdown
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]); // eslint-disable-line

  const logSession = async (type: Phase, minutes: number) => {
    if (!activeTimer || minutes < 1) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("session_logs").insert({
        user_id: user.id,
        task_id: activeTimer.taskId || null,
        duration_minutes: minutes,
        type,
      });
    } catch {}
  };

  const handleComplete = () => {
    setIsRunning(false);
    if (userSettings?.pomodoro_sound !== false) {
      new Audio("/notification.mp3").play().catch(() => {});
    }
    logSession(phase, Math.round(totalTime / 60));
    advance();
  };

  const advance = () => {
    if (phase === "work") {
      const nextPhase = sessionCount % longBreakInterval === 0 ? "long_break" : "short_break";
      setPhase(nextPhase);
    } else if (phase === "long_break") {
      setSessionCount(1);
      setPhase("work");
    } else {
      setSessionCount(prev => prev + 1);
      setPhase("work");
    }
  };

  const handleSkip = () => {
    const spent = totalTime - timeLeft;
    if (spent > 60) logSession(phase, Math.round(spent / 60));
    advance();
  };

  const handleEnd = () => {
    const spent = totalTime - timeLeft;
    if (spent > 60) logSession(phase, Math.round(spent / 60));
    setShowConfirmEnd(false);
    setActiveTimer(null);
  };

  if (!activeTimer) return null;

  const m   = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const s   = (timeLeft % 60).toString().padStart(2, "0");
  const r   = 90;
  const circ = 2 * Math.PI * r;
  const progress = totalTime > 0 ? timeLeft / totalTime : 1;
  const dashoffset = circ * (1 - progress);

  const cfg = PHASE_CONFIG[phase];
  const phaseLabel = phase === "work"
    ? `${cfg.label} · ${sessionCount} of ${longBreakInterval}`
    : cfg.label;

  return (
    <AnimatePresence>
      <motion.div
        key="pomodoro-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
        style={{ background: "rgba(8, 6, 16, 0.92)", backdropFilter: "blur(20px)" }}
      >
        {/* Atmospheric orb */}
        <motion.div
          key={phase}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute pointer-events-none"
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
          className="absolute top-6 right-6 p-2 rounded-full text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-white/10 transition-colors z-10"
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-0">
          {/* Phase label */}
          <p
            className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-1"
            style={{ color: "var(--text-3)" }}
          >
            {phase === "work" ? "Work Session" : phase === "short_break" ? "Short Break" : "Long Break"}
          </p>
          <p className="text-[12px] mb-10" style={{ color: "var(--text-3)" }}>
            {phase === "work" ? `${sessionCount} of ${longBreakInterval}` : "Take a breather"}
          </p>

          {/* SVG Ring + Timer */}
          <div className="relative flex items-center justify-center mb-10" style={{ width: 220, height: 220 }}>
            <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90 absolute inset-0">
              {/* Track */}
              <circle
                cx="110" cy="110" r={r}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="6"
              />
              {/* Progress arc */}
              <motion.circle
                cx="110" cy="110" r={r}
                fill="none"
                stroke={cfg.ring}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circ}
                animate={{ strokeDashoffset: dashoffset }}
                transition={{ duration: 0.9, ease: "linear" }}
              />
            </svg>

            {/* Timer text */}
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
                {m}:{s}
              </span>
            </div>
          </div>

          {/* Task title */}
          <h2 className="text-[14px] font-medium mb-12 text-center max-w-[260px] truncate" style={{ color: "var(--text-2)" }}>
            {activeTimer.taskTitle || "Focus Session"}
          </h2>

          {/* Controls */}
          <div className="flex items-center gap-5">
            {/* Stop */}
            <button
              onClick={() => setShowConfirmEnd(true)}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                "bg-white/5 border border-white/10 text-[var(--text-3)]",
                "hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400"
              )}
              title="End session"
            >
              <Square size={16} strokeWidth={1.5} />
            </button>

            {/* Play / Pause — primary */}
            <button
              onClick={() => setIsRunning(r => !r)}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: cfg.ring }}
              title={isRunning ? "Pause" : "Play"}
            >
              {isRunning
                ? <Pause size={20} strokeWidth={0} className="fill-black" />
                : <Play  size={20} strokeWidth={0} className="fill-black ml-0.5" />
              }
            </button>

            {/* Skip */}
            <button
              onClick={handleSkip}
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                "bg-white/5 border border-white/10 text-[var(--text-3)]",
                "hover:bg-white/10 hover:text-[var(--text-1)]"
              )}
              title="Skip"
            >
              <SkipForward size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Confirm end */}
        <ConfirmModal
          isOpen={showConfirmEnd}
          onClose={() => setShowConfirmEnd(false)}
          onConfirm={handleEnd}
          title="End this session?"
          description={(totalTime - timeLeft) > 60 ? "Your progress so far will be saved." : "This session was too short to be saved."}
          confirmLabel="End Session"
        />
      </motion.div>
    </AnimatePresence>
  );
}
