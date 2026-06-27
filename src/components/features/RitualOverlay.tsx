"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  X, Check, AlertTriangle, Sparkles, Smile, ArrowRight, 
  Clock, Calendar, BookOpen, BarChart2 
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useRouter } from "next/navigation";

// WorkloadBar Component
function WorkloadBar({ total, capacity }: { total: number; capacity: number }) {
  const percentage = Math.min((total / (capacity || 240)) * 100, 100);
  const isOver = total > capacity && capacity > 0;

  return (
    <div className="w-full space-y-2 mt-4" data-testid="workload-bar">
      <div className="flex justify-between text-sm text-[var(--text-2)]">
        <span>Workload Progress: <span className="font-semibold text-[var(--text-1)]">{total}m</span> / {capacity}m capacity</span>
        <span className={isOver ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
          {capacity > 0 ? Math.round((total / capacity) * 100) : 0}%
        </span>
      </div>
      <div className="w-full h-3 rounded-full bg-[var(--surface)] overflow-hidden border border-[var(--border)]">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={`h-full rounded-full transition-all ${
            isOver ? "bg-gradient-to-r from-amber-500 to-red-500" : "bg-gradient-to-r from-emerald-500 to-amber-500"
          }`}
        />
      </div>
      {isOver && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-200 text-xs flex items-start gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="font-semibold text-red-400">Soft Capacity Warning</p>
            <p>You have planned more than your daily capacity. Consider snoozing some tasks or pushing them to backlog to prevent burnout.</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface RitualOverlayProps {
  isOpen?: boolean;
  type?: "morning" | "evening" | null;
  onClose?: () => void;
}

export function RitualOverlay({ isOpen, type, onClose }: RitualOverlayProps = {}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const { 
    activeRitual: storeActiveRitual, 
    setActiveRitual: storeSetActiveRitual, 
    userSettings, 
    updateUserSetting, 
    markMutation 
  } = useAppStore();

  // If props are passed, use them, otherwise fall back to store state
  const activeRitual = type !== undefined ? type : storeActiveRitual;
  const isCurrentlyOpen = isOpen !== undefined ? isOpen : (storeActiveRitual !== null);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      storeSetActiveRitual(null);
    }
  };

  const [step, setStep] = useState<1 | 2>(1); // Morning step: 1 (Triage), 2 (Commit)
  const [triageTasks, setTriageTasks] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const capacity = userSettings.daily_capacity_minutes !== undefined ? userSettings.daily_capacity_minutes : 240;

  const todayString = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  // Fetch data depending on activeRitual
  useEffect(() => {
    if (!activeRitual) return;

    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      if (activeRitual === "morning") {
        setStep(1);
        // Fetch all inbox tasks + overdue tasks (status in [inbox, active] where deadline is set and in the past)
        const { data: tasks } = await supabase
          .from("items")
          .select("*")
          .in("status", ["inbox", "active", "overdue"]);

        if (tasks) {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

          const toTriage = tasks.filter(t => {
            if (t.status === "inbox") return true;
            if (t.status === "active" && t.deadline) {
              const deadlineTime = new Date(t.deadline).getTime();
              return deadlineTime < todayStart;
            }
            if (t.status === "overdue") return true;
            return false;
          });

          const currentToday = tasks.filter(t => {
            if (t.status === "active" && t.deadline) {
              const deadlineTime = new Date(t.deadline).getTime();
              return deadlineTime >= todayStart && deadlineTime < todayStart + 86400000;
            }
            return false;
          });

          setTriageTasks(toTriage);
          setTodayTasks(currentToday);
        }
      } else if (activeRitual === "evening") {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startISO = new Date(todayStart).toISOString();

        // 1. Completed tasks today
        const { data: completed } = await supabase
          .from("items")
          .select("*")
          .eq("status", "done")
          .gte("completed_at", startISO);

        // 2. Incomplete tasks for today (active and deadline is today or past)
        const { data: incomplete } = await supabase
          .from("items")
          .select("*")
          .eq("status", "active");

        if (incomplete) {
          const todayIncomplete = incomplete.filter(t => {
            if (t.deadline) {
              const deadlineTime = new Date(t.deadline).getTime();
              return deadlineTime < todayStart + 86400000;
            }
            return false;
          });
          setTriageTasks(todayIncomplete);
        }

        // 3. Focus minutes from session_logs today
        const { data: logs } = await supabase
          .from("session_logs")
          .select("*")
          .eq("type", "work")
          .gte("completed_at", startISO);

        const mins = logs ? logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0) : 0;

        setCompletedTasks(completed || []);
        setFocusMinutes(mins);
        setReflection("");
      }
      setLoading(false);
    };

    fetchData();
  }, [activeRitual, supabase, todayString]);

  // Actions for Morning Step 1: Triage
  const handleTriageAction = async (taskId: string, action: "today" | "backlog" | "snooze") => {
    let updatePayload: any = {};
    const now = new Date();
    
    if (action === "today") {
      updatePayload = {
        status: "active",
        deadline: now.toISOString()
      };
    } else if (action === "backlog") {
      updatePayload = {
        status: "active",
        deadline: null
      };
    } else if (action === "snooze") {
      const tomorrow = new Date(now.getTime() + 86400000);
      updatePayload = {
        status: "active",
        deadline: tomorrow.toISOString()
      };
    }

    try {
      const task = triageTasks.find(t => t.id === taskId);
      setTriageTasks(prev => prev.filter(t => t.id !== taskId));
      
      if (action === "today" && task) {
        setTodayTasks(prev => [...prev, { ...task, ...updatePayload }]);
      }

      const { error } = await supabase
        .from("items")
        .update(updatePayload)
        .eq("id", taskId);

      if (error) throw error;
      markMutation("items");
      toast.success(`Task scheduled for ${action === "today" ? "today" : action === "snooze" ? "tomorrow" : "backlog"}`);
    } catch (err: any) {
      toast.error("Failed to update task");
      console.error(err);
    }
  };

  // Actions for Morning Step 2: Commit
  const handleEstimateChange = async (taskId: string, minutes: number) => {
    const minVal = Math.max(0, minutes);
    
    setTodayTasks(prev => prev.map(t => t.id === taskId ? { ...t, time_estimate: minVal } : t));

    try {
      const { error } = await supabase
        .from("items")
        .update({ time_estimate: minVal })
        .eq("id", taskId);

      if (error) throw error;
      markMutation("items");
    } catch (err) {
      toast.error("Failed to update estimate");
      console.error(err);
    }
  };

  // Finish Morning Flow
  const handleFinishMorning = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("user_settings")
        .update({ last_ritual_date: todayString })
        .eq("user_id", user.id);

      if (error) throw error;

      updateUserSetting("last_ritual_date", todayString);
      toast.success("Morning planning complete!");
      handleClose();
      router.push("/");
    } catch (err: any) {
      toast.error("Failed to save settings", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Actions for Evening Flow: Carry over
  const handleCarryOver = async (taskId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      setTriageTasks(prev => prev.filter(t => t.id !== taskId));

      const { error } = await supabase
        .from("items")
        .update({ deadline: tomorrow.toISOString() })
        .eq("id", taskId);

      if (error) throw error;
      markMutation("items");
      toast.success("Task carried over to tomorrow");
    } catch (err) {
      toast.error("Failed to carry over task");
      console.error(err);
    }
  };

  // Finish Evening Flow
  const handleFinishEvening = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      if (reflection.trim()) {
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const title = `Daily Note: ${dateStr}`;

        const { data: existing } = await supabase
          .from("threads")
          .select("*")
          .eq("title", title)
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1);

        let threadId = "";
        let entries = [];

        if (existing && existing.length > 0) {
          threadId = existing[0].id;
          entries = existing[0].entries || [];
        } else {
          const { data: inserted } = await supabase
            .from("threads")
            .insert({
              user_id: user.id,
              title,
              color_accent: "#FBBF24",
              is_pinned: true,
              entries: []
            })
            .select("*")
            .single();
          if (inserted) {
            threadId = inserted.id;
            entries = [];
          }
        }

        if (threadId) {
          const entry = { text: reflection.trim(), created_at: new Date().toISOString() };
          const updatedEntries = [...entries, entry];
          
          const { error: threadError } = await supabase
            .from("threads")
            .update({
              entries: updatedEntries,
              last_updated: new Date().toISOString(),
              stale_prompt: null
            })
            .eq("id", threadId);

          if (threadError) throw threadError;
          markMutation("threads");
        }
      }

      const { error } = await supabase
        .from("user_settings")
        .update({ last_ritual_date: todayString })
        .eq("user_id", user.id);

      if (error) throw error;

      updateUserSetting("last_ritual_date", todayString);
      localStorage.setItem('presense_evening_ritual_date', todayString);
      toast.success("Evening reflection complete! Rest well.");
      handleClose();
    } catch (err: any) {
      toast.error("Failed to complete evening ritual", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isCurrentlyOpen || !activeRitual) return null;

  const totalEstimate = todayTasks.reduce((sum, t) => sum + (t.time_estimate || 0), 0);

  return (
    <div 
      data-testid="ritual-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/90 backdrop-blur-xl overflow-y-auto p-4 md:p-6"
    >
      <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--accent)] animate-pulse" />
            <h2 className="text-xl font-bold text-white">
              Sunsama {activeRitual} Ritual
            </h2>
          </div>
          <button 
            onClick={handleClose}
            className="p-1 rounded-full text-[var(--text-3)] hover:text-white hover:bg-[var(--surface)] transition-colors"
            aria-label="Close Ritual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-2)]">Preparing your ritual workspace...</p>
            </div>
          ) : activeRitual === "morning" ? (
            /* MORNING FLOW */
            step === 1 ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Step 1: Triage Inbox & Overdue Tasks</h3>
                    <p className="text-xs text-[var(--text-2)] mt-0.5">
                      Decide what to do with these items. You cannot proceed until all items are triaged.
                    </p>
                  </div>
                </div>

                {triageTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-xl space-y-2">
                    <Smile className="w-8 h-8 text-emerald-400" />
                    <p className="text-sm font-medium text-white">Inbox & Overdue Stack Clear!</p>
                    <p className="text-xs text-[var(--text-2)]">You're ready to plan today's focus estimates.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {triageTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <h4 className="font-medium text-white">{task.title}</h4>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded-full ${
                              task.status === "inbox" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {task.status === "inbox" ? "Inbox" : "Overdue"}
                            </span>
                            {task.deadline && (
                              <span className="text-[var(--text-3)]">
                                Was: {new Date(task.deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button 
                            onClick={() => handleTriageAction(task.id, "today")}
                            className="px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--bg-base)] text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" /> Do Today
                          </button>
                          <button 
                            onClick={() => handleTriageAction(task.id, "backlog")}
                            className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:bg-white/10 text-white text-xs font-medium transition-all"
                          >
                            Backlog
                          </button>
                          <button 
                            onClick={() => handleTriageAction(task.id, "snooze")}
                            className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:bg-white/10 text-white text-xs font-medium flex items-center gap-1 transition-all"
                          >
                            <Clock className="w-3.5 h-3.5" /> Snooze
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-[var(--border)] shrink-0">
                  <span className="text-xs text-[var(--text-3)]">
                    {triageTasks.length} tasks remaining to triage
                  </span>
                  <button 
                    disabled={triageTasks.length > 0}
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] disabled:bg-[var(--surface)] disabled:text-[var(--text-3)] disabled:border disabled:border-[var(--border)] text-[var(--bg-base)] font-bold text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Next Step <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Morning Step 2: Commit Estimates */
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Step 2: Estimate Focus Minutes</h3>
                    <p className="text-xs text-[var(--text-2)] mt-0.5">
                      Assign time estimates to your committed tasks for today.
                    </p>
                  </div>
                </div>

                {todayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-xl space-y-2">
                    <AlertTriangle className="w-8 h-8 text-[var(--accent)]" />
                    <p className="text-sm font-medium text-white">No tasks scheduled for today</p>
                    <p className="text-xs text-[var(--text-2)]">Go back and add some tasks, or proceed with empty schedule.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {todayTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-4"
                      >
                        <span className="font-medium text-white text-sm truncate">{task.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <input 
                            type="number" 
                            min="0"
                            step="5"
                            value={task.time_estimate || 0}
                            onChange={(e) => handleEstimateChange(task.id, parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white text-center font-bold focus:outline-none focus:border-[var(--accent)]"
                          />
                          <span className="text-xs text-[var(--text-3)] font-semibold">mins</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <WorkloadBar total={totalEstimate} capacity={capacity} />

                <div className="flex justify-between items-center pt-4 border-t border-[var(--border)] shrink-0">
                  <button 
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:bg-white/10 text-white font-semibold text-sm transition-all"
                  >
                    Back
                  </button>
                  <button 
                    disabled={saving}
                    onClick={handleFinishMorning}
                    className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--bg-base)] font-bold text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {saving ? "Saving..." : "Start My Day"} <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          ) : (
            /* EVENING FLOW */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stats Panel */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <BarChart2 className="w-5 h-5 text-emerald-400" />
                    <span>Today's Highlights</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-center">
                      <span className="text-[var(--text-3)] text-xs">Completed</span>
                      <span className="text-2xl font-bold text-white mt-1">{completedTasks.length} tasks</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-center">
                      <span className="text-[var(--text-3)] text-xs">Focus Time</span>
                      <span className="text-2xl font-bold text-white mt-1">{focusMinutes}m</span>
                    </div>
                  </div>
                </div>

                {/* Completed Tasks List */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2 flex flex-col">
                  <div className="flex items-center gap-2 text-white font-semibold mb-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Completed Items</span>
                  </div>
                  <div className="flex-1 max-h-[150px] overflow-y-auto space-y-2 pr-1">
                    {completedTasks.length === 0 ? (
                      <p className="text-xs text-[var(--text-3)] italic py-4 text-center">No tasks completed today.</p>
                    ) : (
                      completedTasks.map(t => (
                        <div key={t.id} className="text-xs text-white line-through opacity-60 bg-[var(--surface)] border border-[var(--border)] px-3 py-2 rounded-lg truncate">
                          {t.title}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Carry Over Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Calendar className="w-5 h-5 text-[var(--accent)]" />
                  <span>Carry Over Incomplete Tasks</span>
                </div>
                <p className="text-xs text-[var(--text-2)]">
                  These items were not completed today. Choose to carry them over to tomorrow's plan.
                </p>

                {triageTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                    <Smile className="w-6 h-6 text-emerald-400 mb-1" />
                    <p className="text-xs font-semibold text-white">All scheduled tasks completed or moved!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {triageTasks.map(t => (
                      <div key={t.id} className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-white truncate">{t.title}</span>
                        <button
                          onClick={() => handleCarryOver(t.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--bg-base)] text-[10px] font-bold transition-all shrink-0"
                        >
                          Carry Over
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reflection Box */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <BookOpen className="w-5 h-5 text-[var(--accent)]" />
                  <span>Daily Reflection</span>
                </div>
                <p className="text-xs text-[var(--text-2)]">
                  Write down any notes, thoughts, or wins from today. This reflection will be saved to your Daily Note thread.
                </p>
                <div className="relative">
                  <TextareaAutosize
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="Today was... I achieved... tomorrow I want to..."
                    minRows={3}
                    className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:border-[var(--accent)] transition-all resize-none shadow-inner"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-4 border-t border-[var(--border)] shrink-0">
                <button
                  disabled={saving}
                  onClick={handleFinishEvening}
                  className="px-6 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--bg-base)] font-bold text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {saving ? "Saving..." : "Shut Down & Complete"} <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RitualOverlay;
