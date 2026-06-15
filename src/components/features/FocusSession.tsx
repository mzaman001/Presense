import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pause, Play, CheckCircle2, ChevronRight, SkipForward, Coffee } from "lucide-react";
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

  const getPhaseColor = () => {
    if (isDone) return "text-[#4ADE80] stroke-[#4ADE80]";
    if (phase === "work") return "text-[#8B7CF8] stroke-[#8B7CF8]";
    return "text-[#4ADE80] stroke-[#4ADE80]"; // breaks are green
  };

  const getPhaseGlow = () => {
    if (phase === "work") return "bg-[#8B7CF8]/20";
    return "bg-[#4ADE80]/20";
  };

  const getPhaseText = () => {
    if (phase === "work") return "Focus Session";
    if (phase === "short_break") return "Short Break";
    return "Long Break";
  };

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#0B0914]/90 backdrop-blur-xl"
        >
          {/* Ambient glow */}
          <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none transition-colors duration-1000", getPhaseGlow())} />

          <button onClick={onClose} className="absolute top-8 right-8 p-3 rounded-full bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors text-[rgba(255,255,255,0.5)] hover:text-white">
            <X className="w-6 h-6" />
          </button>

          <div className="text-center mb-12 max-w-lg z-10">
            <div className="flex items-center justify-center gap-2 mb-3">
              {phase !== "work" && <Coffee className={cn("w-4 h-4", isDone ? "text-[#4ADE80]" : phase === "work" ? "text-[#8B7CF8]" : "text-[#4ADE80]")} />}
              <p className={cn("text-[12px] uppercase tracking-widest font-bold", isDone ? "text-[#4ADE80]" : phase === "work" ? "text-[#8B7CF8]" : "text-[#4ADE80]")}>
                {getPhaseText()}
              </p>
            </div>
            <h1 className="text-3xl font-semibold text-white mb-4 leading-tight">{task.title}</h1>
            {task.first_step && (
              <div className="inline-flex items-center gap-2 bg-[rgba(139,124,248,0.1)] border border-[rgba(139,124,248,0.2)] px-4 py-2 rounded-full">
                <ChevronRight className="w-4 h-4 text-[#8B7CF8]" />
                <span className="text-[#8B7CF8] font-medium">{task.first_step}</span>
              </div>
            )}
          </div>

          <div className="relative flex items-center justify-center mb-16 z-10">
            <svg width="300" height="300" className="transform -rotate-90">
              <circle cx="150" cy="150" r={radius} className="stroke-[rgba(255,255,255,0.05)]" strokeWidth="6" fill="none" />
              <motion.circle
                cx="150" cy="150" r={radius}
                className={cn("transition-all duration-1000 ease-linear", getPhaseColor().split(" ")[1])}
                strokeWidth="6" fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={cn("text-5xl font-mono tracking-tighter font-light", getPhaseColor().split(" ")[0])}>
                {formatTime(timeLeft)}
              </span>
              {isDone && <span className="text-sm text-[#4ADE80] font-medium mt-2">Phase Complete!</span>}
            </div>
          </div>

          <div className="flex items-center gap-4 z-10">
            {!isDone ? (
              <>
                <button onClick={() => setIsPaused(!isPaused)} className="w-14 h-14 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-colors text-white">
                  {isPaused ? <Play className="w-6 h-6 ml-1" /> : <Pause className="w-6 h-6" />}
                </button>
                <button onClick={skipToNextPhase} className="w-14 h-14 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-colors text-white" title="Skip phase">
                  <SkipForward className="w-5 h-5" />
                </button>
                <button onClick={onClose} className="px-6 py-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-colors text-white font-medium">
                  End early
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={skipToNextPhase}
                  className="px-8 py-4 rounded-xl bg-[rgba(74,222,128,0.15)] border border-[rgba(74,222,128,0.3)] text-[#4ADE80] font-semibold hover:bg-[rgba(74,222,128,0.25)] transition-colors flex items-center gap-2"
                >
                  Start Next Phase <ChevronRight className="w-4 h-4" />
                </button>
                {phase === "work" && (
                  <button
                    onClick={handleCompleteTask}
                    disabled={completing}
                    className="flex items-center gap-2 px-8 py-4 rounded-xl bg-[#4ADE80] text-black font-bold hover:bg-[#22c55e] transition-colors disabled:opacity-50"
                  >
                    {completing ? "Saving..." : "Mark Complete"} <CheckCircle2 className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
