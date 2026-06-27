"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertTriangle, Sparkles, Moon, ArrowRight, Clock, Calendar, BookOpen, BarChart2, Smile, ChevronLeft, Sun } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useRouter } from "next/navigation";

// ─── WorkloadBar ─────────────────────────────────────────────────────────────
function WorkloadBar({ total, capacity }: { total: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min((total / capacity) * 100, 100) : 0;
  const isOver = capacity > 0 && total > capacity;

  return (
    <div className="space-y-2" data-testid="workload-bar">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-4)" }}>
          Workload
        </span>
        <span className="text-[11px] font-bold" style={{ color: isOver ? "var(--status-overdue)" : "var(--status-done)" }}>
          {total}m / {capacity}m
        </span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: isOver
              ? "linear-gradient(90deg, var(--status-today) 0%, var(--status-overdue) 100%)"
              : "linear-gradient(90deg, var(--accent) 0%, var(--status-done) 100%)",
          }}
        />
      </div>
      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-2 p-3 rounded-xl"
            style={{
              background: "var(--status-overdue-dim)",
              border: "0.5px solid var(--status-overdue-border)",
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--status-overdue)" }} />
            <p className="text-[12px] leading-snug" style={{ color: "var(--text-2)" }}>
              You're over capacity. Consider snoozing a few tasks — rest is part of the plan.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TriageCard ───────────────────────────────────────────────────────────────
function TriageCard({ task, onAction }: { task: any; onAction: (id: string, action: "today" | "backlog" | "snooze") => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass-card p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-snug truncate" style={{ color: "var(--text-1)" }}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: task.status === "inbox" ? "var(--surface-card)" : "var(--status-overdue-dim)",
                color: task.status === "inbox" ? "var(--text-3)" : "var(--status-overdue)",
                border: `0.5px solid ${task.status === "inbox" ? "var(--border-default)" : "var(--status-overdue-border)"}`,
              }}
            >
              {task.status === "inbox" ? "Inbox" : "Overdue"}
            </span>
            {task.deadline && (
              <span className="text-[11px]" style={{ color: "var(--text-4)" }}>
                {new Date(task.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onAction(task.id, "today")}
          className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-[12px] py-2"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Do Today
        </button>
        <button
          onClick={() => onAction(task.id, "snooze")}
          className="btn-ghost flex items-center gap-1 text-[12px] py-2 px-3"
        >
          <Clock className="w-3.5 h-3.5" /> Tomorrow
        </button>
        <button
          onClick={() => onAction(task.id, "backlog")}
          className="btn-ghost text-[12px] py-2 px-3"
          style={{ color: "var(--text-4)" }}
        >
          Backlog
        </button>
      </div>
    </motion.div>
  );
}

// ─── RitualOverlay ────────────────────────────────────────────────────────────
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
    markMutation,
  } = useAppStore();

  const activeRitual = type !== undefined ? type : storeActiveRitual;
  const isCurrentlyOpen = isOpen !== undefined ? isOpen : storeActiveRitual !== null;

  const handleClose = () => {
    if (onClose) onClose();
    else storeSetActiveRitual(null);
  };

  const [step, setStep] = useState<1 | 2>(1);
  const [triageTasks, setTriageTasks] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const capacity = userSettings?.daily_capacity_minutes ?? 240;
  const todayString = useMemo(() => new Date().toLocaleDateString("en-CA"), []);

  useEffect(() => {
    if (!activeRitual) return;
    setStep(1);
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      if (activeRitual === "morning") {
        const { data: tasks } = await supabase
          .from("items")
          .select("*")
          .in("status", ["inbox", "active", "overdue"]);

        if (tasks) {
          const todayStart = new Date().setHours(0, 0, 0, 0);
          const toTriage = tasks.filter(t =>
            t.status === "inbox" ||
            t.status === "overdue" ||
            (t.status === "active" && t.deadline && new Date(t.deadline).getTime() < todayStart)
          );
          const currentToday = tasks.filter(t =>
            t.status === "active" && t.deadline &&
            new Date(t.deadline).getTime() >= todayStart &&
            new Date(t.deadline).getTime() < todayStart + 86400000
          );
          setTriageTasks(toTriage);
          setTodayTasks(currentToday);
        }
      } else {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const startISO = new Date(todayStart).toISOString();

        const [{ data: completed }, { data: incomplete }, { data: logs }] = await Promise.all([
          supabase.from("items").select("*").eq("status", "done").gte("completed_at", startISO),
          supabase.from("items").select("*").eq("status", "active"),
          supabase.from("session_logs").select("*").eq("type", "work").gte("completed_at", startISO),
        ]);

        setCompletedTasks(completed || []);
        setTriageTasks(
          (incomplete || []).filter(t =>
            t.deadline && new Date(t.deadline).getTime() < todayStart + 86400000
          )
        );
        setFocusMinutes(
          (logs || []).reduce((sum: number, l: any) => sum + (l.duration_minutes || 0), 0)
        );
        setReflection("");
      }
      setLoading(false);
    };
    fetchData();
  }, [activeRitual, supabase, todayString]);

  const handleTriageAction = async (taskId: string, action: "today" | "backlog" | "snooze") => {
    const task = triageTasks.find(t => t.id === taskId);
    setTriageTasks(prev => prev.filter(t => t.id !== taskId));

    const now = new Date();
    const payload =
      action === "today"   ? { status: "active", deadline: now.toISOString() } :
      action === "snooze"  ? { status: "active", deadline: new Date(now.getTime() + 86400000).toISOString() } :
                             { status: "active", deadline: null };

    if (action === "today" && task) setTodayTasks(prev => [...prev, { ...task, ...payload }]);

    try {
      const { error } = await supabase.from("items").update(payload).eq("id", taskId);
      if (error) throw error;
      markMutation("items");
    } catch { toast.error("Failed to update task"); }
  };

  const handleEstimateChange = async (taskId: string, minutes: number) => {
    const val = Math.max(0, minutes);
    setTodayTasks(prev => prev.map(t => t.id === taskId ? { ...t, time_estimate: val } : t));
    try {
      await supabase.from("items").update({ time_estimate: val }).eq("id", taskId);
      markMutation("items");
    } catch { toast.error("Failed to update estimate"); }
  };

  const handleFinishMorning = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      const { error } = await supabase.from("user_settings").update({ last_ritual_date: todayString }).eq("user_id", user.id);
      if (error) throw error;
      updateUserSetting("last_ritual_date", todayString);
      toast.success("Morning planning done — have a focused day!");
      handleClose();
      router.push("/");
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally { setSaving(false); }
  };

  const handleCarryOver = async (taskId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setTriageTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      const { error } = await supabase.from("items").update({ deadline: tomorrow.toISOString() }).eq("id", taskId);
      if (error) throw error;
      markMutation("items");
      toast.success("Carried over to tomorrow");
    } catch { toast.error("Failed to carry over"); }
  };

  const handleFinishEvening = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      if (reflection.trim()) {
        const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const title = `Daily Note: ${dateStr}`;
        const { data: existing } = await supabase.from("threads").select("*").eq("title", title).eq("user_id", user.id).eq("status", "active").limit(1);

        let threadId = "";
        let entries: any[] = [];

        if (existing && existing.length > 0) {
          threadId = existing[0].id;
          entries = existing[0].entries || [];
        } else {
          const { data: inserted } = await supabase.from("threads").insert({ user_id: user.id, title, color_accent: "#E5B41E", is_pinned: true, entries: [] }).select("*").single();
          if (inserted) { threadId = inserted.id; entries = []; }
        }

        if (threadId) {
          await supabase.from("threads").update({
            entries: [...entries, { text: reflection.trim(), created_at: new Date().toISOString() }],
            last_updated: new Date().toISOString(),
          }).eq("id", threadId);
          markMutation("threads");
        }
      }

      const { error } = await supabase.from("user_settings").update({ last_ritual_date: todayString }).eq("user_id", user.id);
      if (error) throw error;
      updateUserSetting("last_ritual_date", todayString);
      localStorage.setItem("presense_evening_ritual_date", todayString);
      toast.success("Shutdown complete. Rest well.");
      handleClose();
    } catch (err: any) {
      toast.error("Failed to complete evening ritual", { description: err.message });
    } finally { setSaving(false); }
  };

  const totalEstimate = todayTasks.reduce((sum, t) => sum + (t.time_estimate || 0), 0);

  if (!isCurrentlyOpen || !activeRitual) return null;

  const isMorning = activeRitual === "morning";

  return (
    <AnimatePresence>
      <motion.div
        key="ritual-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
        style={{ background: "var(--bg-backdrop)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
        data-testid="ritual-overlay"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="modal w-full max-w-lg flex flex-col max-h-[88vh] overflow-hidden"
        >
          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--accent-dim)", border: "0.5px solid var(--accent-border)" }}
              >
                {isMorning
                  ? <Sun className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  : <Moon className="w-4 h-4" style={{ color: "var(--accent)" }} />
                }
              </div>
              <div>
                <h2 className="text-[14px] font-bold leading-none" style={{ color: "var(--text-1)" }}>
                  {isMorning ? "Morning Planning" : "Evening Review"}
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>
                  {isMorning
                    ? `Step ${step} of 2 — ${step === 1 ? "Triage" : "Commit"}`
                    : "Shutdown ritual"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Step dots (morning only) */}
              {isMorning && (
                <div className="flex items-center gap-1.5 mr-2">
                  {[1, 2].map(s => (
                    <div
                      key={s}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: step === s ? "16px" : "6px",
                        height: "6px",
                        background: step === s ? "var(--accent)" : "var(--border-strong)",
                      }}
                    />
                  ))}
                </div>
              )}
              <button onClick={handleClose} className="btn-icon" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--accent-border)", borderTopColor: "var(--accent)" }}
                />
                <p className="text-[12px]" style={{ color: "var(--text-4)" }}>
                  Preparing your ritual…
                </p>
              </div>
            ) : isMorning ? (
              step === 1 ? (
                /* ── Morning Step 1: Triage ── */
                <div className="space-y-4">
                  <div
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: "var(--accent-dim)", border: "0.5px solid var(--accent-border)" }}
                  >
                    <Calendar className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                      Triage your inbox and overdue tasks before starting your day. You can't proceed until all are handled.
                    </p>
                  </div>

                  {triageTasks.length === 0 ? (
                    <div
                      className="flex flex-col items-center gap-2 py-10 rounded-2xl"
                      style={{ background: "var(--surface-card)", border: "0.5px dashed var(--border-default)" }}
                    >
                      <Smile className="w-7 h-7" style={{ color: "var(--status-done)" }} />
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>All clear!</p>
                      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>No inbox or overdue tasks.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-4)" }}>
                          To triage
                        </span>
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "var(--surface-card)", color: "var(--text-3)", border: "0.5px solid var(--border-default)" }}
                        >
                          {triageTasks.length} remaining
                        </span>
                      </div>
                      <AnimatePresence mode="popLayout">
                        {triageTasks.map(task => (
                          <TriageCard key={task.id} task={task} onAction={handleTriageAction} />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Morning Step 2: Commit ── */
                <div className="space-y-4">
                  <div
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: "var(--accent-dim)", border: "0.5px solid var(--accent-border)" }}
                  >
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                      Estimate how long each task will take. Default is 25 min (1 Pomodoro).
                    </p>
                  </div>

                  {todayTasks.length === 0 ? (
                    <div
                      className="flex flex-col items-center gap-2 py-10 rounded-2xl"
                      style={{ background: "var(--surface-card)", border: "0.5px dashed var(--border-default)" }}
                    >
                      <Sparkles className="w-7 h-7" style={{ color: "var(--accent)" }} />
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>No tasks committed yet</p>
                      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>Go back and schedule some tasks for today.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {todayTasks.map(task => (
                        <div
                          key={task.id}
                          className="glass-card px-4 py-3 flex items-center justify-between gap-4"
                        >
                          <p className="text-[13px] font-medium truncate flex-1" style={{ color: "var(--text-1)" }}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="number"
                              min="0"
                              step="5"
                              value={task.time_estimate || 25}
                              onChange={e => handleEstimateChange(task.id, parseInt(e.target.value) || 0)}
                              className="w-16 text-center text-[13px] font-bold rounded-lg px-2 py-1.5 focus:outline-none transition-colors"
                              style={{
                                background: "var(--surface-input)",
                                border: "0.5px solid var(--border-input)",
                                color: "var(--text-1)",
                              }}
                            />
                            <span className="text-[11px]" style={{ color: "var(--text-4)" }}>min</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <WorkloadBar total={totalEstimate} capacity={capacity} />
                </div>
              )
            ) : (
              /* ── Evening Flow ── */
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-card-hero px-4 py-4 flex flex-col gap-1 !rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-4)" }}>Completed</span>
                    <span className="text-[28px] font-bold leading-none" style={{ color: "var(--text-1)" }}>{completedTasks.length}</span>
                    <span className="text-[11px]" style={{ color: "var(--status-done)" }}>tasks done today</span>
                  </div>
                  <div className="glass-card px-4 py-4 flex flex-col gap-1 !rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-4)" }}>Focus Time</span>
                    <span className="text-[28px] font-bold leading-none" style={{ color: "var(--text-1)" }}>{focusMinutes}m</span>
                    <span className="text-[11px]" style={{ color: "var(--accent)" }}>Pomodoros logged</span>
                  </div>
                </div>

                {/* Completed tasks */}
                {completedTasks.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-4)" }}>
                      Done today
                    </span>
                    <div
                      className="rounded-xl overflow-hidden divide-y max-h-36 overflow-y-auto"
                      style={{ background: "var(--surface-card)", border: "0.5px solid var(--border-card)" }}
                    >
                      {completedTasks.map(t => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--status-done-dim)" }}>
                            <Check className="w-2.5 h-2.5" style={{ color: "var(--status-done)" }} strokeWidth={3} />
                          </div>
                          <p className="text-[12px] line-through truncate" style={{ color: "var(--text-3)" }}>{t.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Carry over */}
                {triageTasks.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-4)" }}>
                        Carry over
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--text-4)" }}>{triageTasks.length} incomplete</span>
                    </div>
                    <div className="space-y-1.5">
                      <AnimatePresence mode="popLayout">
                        {triageTasks.map(t => (
                          <motion.div
                            key={t.id}
                            layout
                            exit={{ opacity: 0, x: 20 }}
                            className="glass-card px-4 py-2.5 flex items-center justify-between gap-3"
                          >
                            <p className="text-[12px] truncate flex-1" style={{ color: "var(--text-2)" }}>{t.title}</p>
                            <button
                              onClick={() => handleCarryOver(t.id)}
                              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
                              style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "0.5px solid var(--accent-border)" }}
                            >
                              → Tomorrow
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Daily reflection */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" style={{ color: "var(--text-4)" }} />
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-4)" }}>
                      Daily reflection
                    </span>
                  </div>
                  <TextareaAutosize
                    value={reflection}
                    onChange={e => setReflection(e.target.value)}
                    placeholder="What went well today? What do you want to carry into tomorrow?"
                    minRows={3}
                    className="w-full px-4 py-3 text-[13px] rounded-xl resize-none focus:outline-none transition-colors"
                    style={{
                      background: "var(--surface-input)",
                      border: "0.5px solid var(--border-input)",
                      color: "var(--text-1)",
                    }}
                    onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-input)")}
                  />
                  <p className="text-[10px]" style={{ color: "var(--text-4)" }}>
                    Saved to your Daily Note in Think.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderTop: "0.5px solid var(--border-subtle)" }}
          >
            {isMorning && step === 2 ? (
              <button onClick={() => setStep(1)} className="btn-ghost flex items-center gap-1.5 text-[13px]">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {isMorning ? (
              step === 1 ? (
                <button
                  disabled={triageTasks.length > 0}
                  onClick={() => setStep(2)}
                  className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled={saving}
                  onClick={handleFinishMorning}
                  className="btn-primary flex items-center gap-2"
                >
                  {saving ? "Saving…" : "Start my day"} <Sparkles className="w-4 h-4" />
                </button>
              )
            ) : (
              <button
                disabled={saving}
                onClick={handleFinishEvening}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? "Saving…" : "Shut down"} <Moon className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default RitualOverlay;
