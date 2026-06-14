import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pause, Play, CheckCircle2, ChevronRight } from "lucide-react";
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

export function FocusSession({ task, onClose, onComplete }: FocusSessionProps) {
  const [totalTime, setTotalTime] = useState(10 * 60); // Default 10 mins
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Fetch duration setting
  useEffect(() => {
    async function loadDuration() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from("user_settings").select("pomodoro_duration").eq("user_id", user.id).single();
      if (data && data.pomodoro_duration) {
        const secs = data.pomodoro_duration * 60;
        setTotalTime(secs);
        setTimeLeft(secs);
      }
    }
    if (task) loadDuration();
  }, [task]);

  useEffect(() => {
    if (!task || isPaused || isDone || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [task, isPaused, isDone, timeLeft]);

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
      const logEntry = { text: `🎯 Completed focus session for: ${task.title}`, created_at: new Date().toISOString() };
      
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

      // Increment pomodoro stat
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: currentSettings } = await supabase.from("user_settings").select("pomodoros_completed").eq("user_id", currentUser.id).single();
        if (currentSettings) {
          await supabase.from("user_settings").update({ pomodoros_completed: (currentSettings.pomodoros_completed || 0) + 1 }).eq("user_id", currentUser.id);
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

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#0B0914]/90 backdrop-blur-xl"
        >
          {/* Ambient glow specifically for focus mode */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#8B7CF8]/20 rounded-full blur-[100px] pointer-events-none" />

          <button onClick={onClose} className="absolute top-8 right-8 p-3 rounded-full bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors text-[rgba(255,255,255,0.5)] hover:text-white">
            <X className="w-6 h-6" />
          </button>

          <div className="text-center mb-12 max-w-lg z-10">
            <p className="text-[12px] uppercase tracking-widest text-[#8B7CF8] font-bold mb-3">Focus Session</p>
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
              {/* Background track */}
              <circle
                cx="150"
                cy="150"
                r={radius}
                className="stroke-[rgba(255,255,255,0.05)]"
                strokeWidth="6"
                fill="none"
              />
              {/* Progress track */}
              <motion.circle
                cx="150"
                cy="150"
                r={radius}
                className={cn("transition-all duration-1000 ease-linear", isDone ? "stroke-[#4ADE80]" : "stroke-[#8B7CF8]")}
                strokeWidth="6"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={cn("text-5xl font-mono tracking-tighter font-light", isDone ? "text-[#4ADE80]" : "text-white")}>
                {formatTime(timeLeft)}
              </span>
              {isDone && <span className="text-sm text-[#4ADE80] font-medium mt-2">{Math.floor(totalTime / 60)} Min Complete!</span>}
            </div>
          </div>

          <div className="flex items-center gap-4 z-10">
            {!isDone ? (
              <>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-colors text-white"
                >
                  {isPaused ? <Play className="w-6 h-6 ml-1" /> : <Pause className="w-6 h-6" />}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] transition-colors text-white font-medium"
                >
                  End early
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setTimeLeft(totalTime); setIsDone(false); }}
                  className="px-8 py-4 rounded-xl bg-[rgba(139,124,248,0.15)] border border-[rgba(139,124,248,0.3)] text-[#8B7CF8] font-semibold hover:bg-[rgba(139,124,248,0.25)] transition-colors"
                >
                  Keep going ({Math.floor(totalTime / 60)}m)
                </button>
                <button
                  onClick={handleCompleteTask}
                  disabled={completing}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-[#4ADE80] text-black font-bold hover:bg-[#22c55e] transition-colors disabled:opacity-50"
                >
                  {completing ? "Saving..." : "Mark Complete"} <CheckCircle2 className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
