"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { X, Play, Pause, SkipForward, Square } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "../ui/ConfirmModal";
import { motion, AnimatePresence } from "framer-motion";

export function PomodoroTimer() {
  const { activeTimer, setActiveTimer, userSettings } = useAppStore();
  const supabase = createClient();

  const [sessionType, setSessionType] = useState<"work" | "short_break" | "long_break">("work");
  const [sessionCount, setSessionCount] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  // Settings with fallbacks
  const workDuration = (userSettings?.pomodoro_duration || 25) * 60;
  const shortBreakDuration = (userSettings?.short_break_duration || 5) * 60;
  const longBreakDuration = (userSettings?.long_break_duration || 15) * 60;
  const longBreakInterval = userSettings?.pomodoro_long_break_interval || 4;
  const autoStartBreaks = userSettings?.auto_start_breaks || false;

  // Initialize timer when opened or session type changes
  useEffect(() => {
    if (activeTimer) {
      let time = workDuration;
      if (sessionType === "short_break") time = shortBreakDuration;
      if (sessionType === "long_break") time = longBreakDuration;
      
      setTimeLeft(time);
      setTotalTime(time);
      setIsActive(sessionType === "work" || autoStartBreaks);
    }
  }, [activeTimer, sessionType, workDuration, shortBreakDuration, longBreakDuration, autoStartBreaks]);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      handleSessionComplete();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const logSession = async (type: string, durationMinutes: number) => {
    if (!activeTimer) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("session_logs").insert({
        user_id: user.id,
        task_id: activeTimer.taskId || null,
        duration_minutes: durationMinutes,
        type: type
      });
    } catch (e) {
      console.error("Failed to log session:", e);
    }
  };

  const handleSessionComplete = () => {
    setIsActive(false);
    
    // Play sound if enabled
    if (userSettings?.pomodoro_sound !== false) {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    }

    // Log the completed session
    const currentDurationMin = Math.round(totalTime / 60);
    logSession(sessionType, currentDurationMin);

    advanceSession();
  };

  const advanceSession = () => {
    if (sessionType === "work") {
      // Move to break
      if (sessionCount % longBreakInterval === 0) {
        setSessionType("long_break");
      } else {
        setSessionType("short_break");
      }
      if (!autoStartBreaks) setIsActive(false);
    } else {
      // Move back to work
      setSessionType("work");
      setSessionCount(prev => prev + 1);
      setIsActive(false); // Usually wait for user to start work
    }
  };

  const handleSkip = () => {
    // Log partial session or treat as complete?
    // We will log as completed for tracking, or just skip without logging?
    // Let's log whatever time was spent if it's > 1 minute, otherwise skip.
    const timeSpent = totalTime - timeLeft;
    if (timeSpent > 60) {
      logSession(sessionType, Math.round(timeSpent / 60));
    }
    advanceSession();
  };

  const handleEndSession = () => {
    const timeSpent = totalTime - timeLeft;
    if (timeSpent > 60) {
      logSession(sessionType, Math.round(timeSpent / 60));
    }
    setShowConfirmEnd(false);
    setActiveTimer(null);
  };

  if (!activeTimer) return null;

  // Format time (MM:SS)
  const m = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const s = (timeLeft % 60).toString().padStart(2, "0");

  // SVG Circle calculations
  const r = 80;
  const circ = 2 * Math.PI * r;
  const offset = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * circ : 0;

  let sessionLabel = "";
  if (sessionType === "work") sessionLabel = `Work Session · ${sessionCount} of ${longBreakInterval}`;
  else if (sessionType === "short_break") sessionLabel = "Short Break";
  else sessionLabel = "Long Break";

  const accentColor = sessionType === "work" ? "var(--color-accent)" : "#2DD4BF";

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl relative flex flex-col items-center text-center"
        >
          {/* Header */}
          <button onClick={() => setShowConfirmEnd(true)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors text-[var(--color-text-3)]">
            <X className="w-5 h-5" />
          </button>
          
          <h2 className="text-[18px] font-medium text-[var(--color-text-1)] mb-1 px-8 line-clamp-1">
            {activeTimer.taskTitle || "Focus Session"}
          </h2>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-8">
            {sessionLabel}
          </p>

          {/* Timer Ring */}
          <div className="relative flex items-center justify-center w-[200px] h-[200px] mb-8">
            <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
              <circle cx="100" cy="100" r={r} fill="transparent" stroke="var(--color-surface)" strokeWidth="8" />
              <circle 
                cx="100" cy="100" r={r} fill="transparent" 
                stroke={accentColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-light tracking-tighter" style={{ fontFamily: "JetBrains Mono, monospace", color: accentColor }}>
                {m}:{s}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowConfirmEnd(true)}
              className="p-3 rounded-full bg-[var(--color-surface)] text-[var(--color-text-2)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="End Session"
            >
              <Square className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setIsActive(!isActive)}
              className="w-16 h-16 flex items-center justify-center rounded-full text-black transition-transform hover:scale-105 active:scale-95 shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              {isActive ? <Pause className="w-8 h-8 fill-black" /> : <Play className="w-8 h-8 fill-black ml-1" />}
            </button>

            <button 
              onClick={handleSkip}
              className="p-3 rounded-full bg-[var(--color-surface)] text-[var(--color-text-2)] hover:text-[var(--color-text-1)] transition-colors"
              title="Skip"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {showConfirmEnd && (
          <ConfirmModal
            isOpen={showConfirmEnd}
            onClose={() => setShowConfirmEnd(false)}
            onConfirm={handleEndSession}
            title="End this session?"
            description="Your progress so far will be saved."
            confirmLabel="End Session"
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
