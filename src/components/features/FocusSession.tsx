import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pause, Play, CheckCircle2, ChevronRight, SkipForward, Coffee, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FocusSessionProps {
  task: {
    id: string;
    title: string;
    first_step: string | null;
  } | null;
  onClose: () => void;
  onComplete: () => void;
}

type SessionPhase = "work" | "short_break" | "long_break";

export function FocusSession({ task, onClose, onComplete }: FocusSessionProps) {
  const [phase, setPhase] = useState<SessionPhase>("work");
  const [pomodorosCompleted, setPomodorosCompleted] = useState(0);

  const [durations, setDurations] = useState({ work: 25 * 60, short_break: 5 * 60, long_break: 15 * 60 });
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);

  const [totalTime, setTotalTime] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  
  const [isPaused, setIsPaused] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Fetch durations
  useEffect(() => {
    async function loadDuration() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from("user_settings").select("pomodoro_duration, short_break_duration, long_break_duration, auto_start_breaks").eq("user_id", user.id).single();
      if (data) {
        const w = (data.pomodoro_duration || 25) * 60;
        const sb = (data.short_break_duration || 5) * 60;
        const lb = (data.long_break_duration || 15) * 60;
        setDurations({ work: w, short_break: sb, long_break: lb });
        setAutoStartBreaks(data.auto_start_breaks || false);
        setTotalTime(w);
        setTimeLeft(w);
      }
    }
    if (task) loadDuration();
  }, [task]);

  useEffect(() => {
    if (!task || isPaused || isDone || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handlePhaseComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [task, isPaused, isDone, timeLeft]);

  const handlePhaseComplete = async () => {
    setIsDone(true);
    // Log session to DB
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && task) {
      const durationMins = Math.floor(totalTime / 60);
      await supabase.from("session_logs").insert({
        user_id: user.id,
        task_id: task.id,
        duration_minutes: durationMins,
        type: phase
      });

      if (phase === "work") {
        // Also update total pomodoros completed count for the user
        const { data: currentSettings } = await supabase.from("user_settings").select("pomodoros_completed").eq("user_id", user.id).single();
        if (currentSettings) {
          await supabase.from("user_settings").update({ pomodoros_completed: (currentSettings.pomodoros_completed || 0) + 1 }).eq("user_id", user.id);
        }
      }
    }

    // Determine next phase automatically if setting is enabled (and if we just finished work)
    if (autoStartBreaks && phase === "work") {
      const completed = pomodorosCompleted + 1;
      setPomodorosCompleted(completed);
      // Every 4th pomodoro is a long break
      if (completed % 4 === 0) {
        startPhase("long_break");
      } else {
        startPhase("short_break");
      }
    }
  };

  const startPhase = (nextPhase: SessionPhase) => {
    setPhase(nextPhase);
    const newTotal = durations[nextPhase];
    setTotalTime(newTotal);
    setTimeLeft(newTotal);
    setIsDone(false);
    setIsPaused(false);
  };

  const skipToNextPhase = () => {
    if (phase === "work") {
      const completed = pomodorosCompleted + 1;
      setPomodorosCompleted(completed);
      if (completed % 4 === 0) startPhase("long_break");
      else startPhase("short_break");
    } else {
      startPhase("work");
    }
  };

  // SVG Circle calculations
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleCompleteTask = async () => {
    if (!task) return;
    setCompleting(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("items").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", task.id);
      if (error) throw error;
      
      // Log to Daily Note
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const title = `Daily Note: ${dateStr}`;
      
      const { data: existingThread } = await supabase.from("threads").select("id, entries").eq("title", title).single();
      const logEntry = { text: `🎯 Completed: ${task.title} (took ${pomodorosCompleted} sessions)`, created_at: new Date().toISOString() };
      
      if (existingThread) {
        await supabase.from("threads").update({ 
          entries: [...(existingThread.entries || []), logEntry],
          last_updated: new Date().toISOString()
        }).eq("id", existingThread.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("threads").insert({
            user_id: user.id,
            title,
            color_accent: "#FBBF24",
            is_pinned: true,
            entries: [logEntry]
          });
        }
      }

      toast.success("Task marked complete!");
      onComplete();
      onClose();
    } catch (err: any) {
      toast.error("Failed to complete task", { description: err.message });
    } finally {
      setCompleting(false);
    }
  };

  const getColors = () => {
    if (phase === "work") return "text-[var(--text-1)] stroke-[var(--accent)]";
    return "text-[var(--text-1)] stroke-[var(--space-think)]";
  };

  const getBgColors = () => {
    if (phase === "work") return "bg-[var(--accent)]/10";
    return "bg-[var(--space-think)]/10";
  };

  useEffect(() => {
    if (phase !== "work") {
      document.body.style.setProperty("--orb-animation-duration", "18s");
    } else {
      document.body.style.removeProperty("--orb-animation-duration");
    }
    return () => { document.body.style.removeProperty("--orb-animation-duration"); };
  }, [phase]);

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-xl transition-colors duration-1000",
            phase === "work" ? "bg-black/60" : "bg-black/80"
          )}
        >
          {/* Ambient glow */}
          <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none transition-colors duration-1000", getBgColors())} />

          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-3)] hover:text-[var(--text-1)]">
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>

          <div className="flex flex-col items-center z-10 w-full max-w-sm">
            <div className="text-center mb-10">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-3)] mb-1">
                {phase === "work" ? "Work Session" : phase === "short_break" ? "Short Break" : "Long Break"}
              </p>
              <p className="text-[12px] text-[var(--text-3)]">
                {pomodorosCompleted + 1} of 4
              </p>
            </div>

            <div className="relative flex items-center justify-center mb-12">
              <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                <circle cx="100" cy="100" r={80} className="stroke-[var(--border-default)]" strokeWidth="8" fill="none" />
                <motion.circle
                  cx="100" cy="100" r={80}
                  className={cn("transition-all duration-1000 ease-linear", getColors().split(" ")[1])}
                  strokeWidth="8" fill="none"
                  strokeDasharray={502.65}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={cn("text-[48px] font-mono", getColors().split(" ")[0])}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>

            <h2 className="text-[14px] font-medium text-[var(--text-2)] mb-12 text-center max-w-xs truncate">
              {task.title}
            </h2>
            <div className="flex items-center gap-6">
              <button onClick={() => setIsPaused(!isPaused)} className="flex items-center gap-2 px-4 py-2 text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors">
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span className="text-[13px] font-medium">{isPaused ? "Resume" : "Pause"}</span>
              </button>
              <button onClick={skipToNextPhase} className="flex items-center gap-2 px-4 py-2 text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors">
                <SkipForward className="w-4 h-4" />
                <span className="text-[13px] font-medium">Skip</span>
              </button>
              <button onClick={handleCompleteTask} disabled={completing} className="flex items-center gap-2 px-4 py-2 text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors disabled:opacity-50">
                <div className="w-3 h-3 bg-current rounded-[2px]" />
                <span className="text-[13px] font-medium">{completing ? "Ending..." : "End"}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

