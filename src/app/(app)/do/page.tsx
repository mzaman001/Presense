"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { FocusSession } from "@/components/features/FocusSession";
import { Plus, ChevronRight, CheckCircle2, Circle, Loader2, Zap, Clock, Calendar, Play, RotateCw } from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import { cn, formatRRule } from "@/lib/utils";
import { toast } from "sonner";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useAppStore } from "@/store/useAppStore";

interface Task {
  id: string;
  title: string;
  first_step: string | null;
  ifthen_trigger: string | null;
  deadline: string | null;
  status: string;
  category: string;
  snoozed_until?: string | null;
  recurrence?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  work: "var(--color-accent)", study: "#2DD4BF", personal: "#F472B6",
  errand: "#FBBF24", health: "#4ADE80", other: "rgba(255,255,255,0.4)",
};

function formatDeadline(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 0) return "Overdue";
  if (diffH < 1) return "< 1 hr";
  if (diffH < 24) return `${Math.round(diffH)}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 0) return "Today";
  if (diffD === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

import { useSearchParams } from "next/navigation";

export default function DoPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter") === "inbox" ? "inbox" : "all";
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>(initialFilter);
  const [completing, setCompleting] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  const { userSettings } = useAppStore();
  const isBoardView = userSettings?.default_view === "board";

  const [showArchive, setShowArchive] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .in("status", ["active", "overdue", "inbox"])
      .order("priority", { ascending: true, nullsFirst: false })
      .order("deadline", { ascending: true, nullsFirst: false });
    setTasks(data ?? []);
    setLoading(false);
  }, [supabase]);

  const fetchArchived = useCallback(async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("status", "done")
      .order("completed_at", { ascending: false });
    setArchivedTasks(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchTasks();
    if (showArchive) fetchArchived();
  }, [fetchTasks, fetchArchived, showArchive]);

  useRealtime("items", fetchTasks);

  const completeTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // Optimistic UI
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;
    const task = tasks[taskIndex];
    setTasks(prev => prev.filter(t => t.id !== id));
    
    try {
      const { error } = await supabase.from("items").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      
      toast.success("Task completed", {
        action: {
          label: "Undo",
          onClick: async () => {
            await supabase.from("items").update({ status: "active", completed_at: null }).eq("id", id);
            fetchTasks();
            toast.success("Task restored");
          }
        },
        duration: 5000
      });
      if (showArchive) fetchArchived();
    } catch (err: any) {
      toast.error("Failed to complete task", { description: err.message });
      // Revert optimistic update
      setTasks(prev => {
        const newTasks = [...prev];
        newTasks.splice(taskIndex, 0, task);
        return newTasks;
      });
    }
  };

  const restoreTask = async (id: string) => {
    try {
      await supabase.from("items").update({ status: "active", completed_at: null }).eq("id", id);
      fetchTasks();
      fetchArchived();
      toast.success("Task restored");
    } catch (err: any) {
      toast.error("Failed to restore task");
    }
  };

  const openEditPanel = (task: Task) => {
    setTaskToEdit(task);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => setTaskToEdit(null), 300);
  };

  const now = new Date();
  
  // Exclude tasks whose start_date is in the future
  const startedTasks = tasks.filter((t) => {
    if (!(t as any).start_date) return true;
    return new Date((t as any).start_date) <= now;
  });

  const filtered = startedTasks.filter(t => {
    if (categoryFilter === "all") return t.status === "active";
    if (categoryFilter === "inbox") return t.status === "inbox";
    if (categoryFilter === "today") {
      if (!t.deadline || t.status !== "active") return false;
      const d = new Date(t.deadline);
      const now = new Date();
      return (d <= now || d.toDateString() === now.toDateString());
    }
    return t.category === categoryFilter && t.status === "active";
  });
  
  const overdue = filtered.filter((t) => t.deadline && new Date(t.deadline) < now);
  const today = filtered.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d >= now && d.toDateString() === now.toDateString();
  });
  const upcoming = filtered.filter((t) => {
    if (!t.deadline) return true;
    const d = new Date(t.deadline);
    return d > now && d.toDateString() !== now.toDateString();
  });

  const CATEGORIES = ["all", "today", "work", "study", "personal", "errand", "health", "inbox"];

  const TaskCard = ({ task }: { task: Task }) => {
    const label = formatDeadline(task.deadline);
    const isOverdue = label === "Overdue";
    const subtasks: {completed: boolean}[] = (task as any).subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const priority = (task as any).priority || 4;

    const priorityColor = priority === 1 ? "#F87171" : priority === 2 ? "#FBBF24" : priority === 3 ? "#2DD4BF" : "transparent";

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <GlassCard onClick={() => openEditPanel(task)} className={cn("p-4 group cursor-pointer hover:scale-[1.01] transition-transform", isOverdue && "border-[rgba(248,113,113,0.3)]")}>
          <div className="flex items-start gap-3">
            <button
              onClick={(e) => completeTask(e, task.id)}
              className="mt-0.5 shrink-0 text-[rgba(255,255,255,0.3)] hover:text-[#4ADE80] transition-colors"
            >
              {completing === task.id
                ? <Loader2 className="w-5 h-5 animate-spin text-[#4ADE80]" />
                : <Circle className="w-5 h-5" />
              }
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {priority < 4 && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityColor }} />}
                {isOverdue && <span className="text-[10px] font-bold uppercase tracking-widest text-[#F87171]">Overdue</span>}
                {label === "Today" && <span className="text-[10px] font-bold uppercase tracking-widest text-[#FBBF24]">Due Today</span>}
                <span className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] capitalize"
                  style={{ color: CATEGORY_COLORS[task.category] ?? "rgba(255,255,255,0.35)" }}>
                  {task.category}
                </span>
              </div>
              <p className="text-sm font-semibold text-white leading-snug">{task.title}</p>
              {task.first_step && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: isOverdue ? "#F87171" : "#2DD4BF" }}>
                  <ChevronRight className="w-3 h-3 shrink-0" /> {task.first_step}
                </p>
              )}
              {task.ifthen_trigger && (
                <p className="text-[11px] text-[rgba(255,255,255,0.35)] mt-1 leading-snug">
                  {task.ifthen_trigger}
                </p>
              )}
              {subtasks.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                    <div className="h-full bg-[rgba(255,255,255,0.3)] transition-all" style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-medium shrink-0">{completedSubtasks}/{subtasks.length}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(255,255,255,0.05)]">
            <span className="text-[11px] text-[rgba(255,255,255,0.35)] shrink-0">
              {label && label !== "Overdue" && label !== "Today" ? label : "Active"}
            </span>
            <div className="flex items-center gap-2">
              {(task.snoozed_until && new Date(task.snoozed_until) > new Date()) && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]">
                  <Clock className="w-3 h-3 text-[rgba(255,255,255,0.4)]" />
                  <span className="text-[10px] text-[rgba(255,255,255,0.4)]">
                    {new Date(task.snoozed_until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await supabase.from('items').update({ snoozed_until: null }).eq('id', task.id);
                      fetchTasks();
                    }}
                    className="ml-1 text-[rgba(255,255,255,0.4)] hover:text-white"
                  >
                    ×
                  </button>
                </div>
              )}
              {task.recurrence && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]">
                  <RotateCw className="w-3 h-3 text-[rgba(255,255,255,0.4)]" />
                  <span className="text-[10px] text-[rgba(255,255,255,0.4)] truncate max-w-[80px]">
                    {formatRRule(task.recurrence)}
                  </span>
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setFocusTask(task); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors text-[11px] font-semibold"
              >
                Start 10 min <Play className="w-3 h-3" />
              </button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  const Column = ({ title, tasks: colTasks, accent, icon: Icon }:
    { title: string; tasks: Task[]; accent: string; icon: React.ElementType }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {colTasks.length > 0 && (
          <Badge style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>
            {colTasks.length}
          </Badge>
        )}
      </div>
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {colTasks.length === 0 ? (
            <div className="text-sm text-[rgba(255,255,255,0.2)] text-center py-8 border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl">
              Nothing here
            </div>
          ) : (
            colTasks.map((t) => <TaskCard key={t.id} task={t} />)
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-medium text-white tracking-tight">Do</h1>
            <button 
              onClick={() => setShowArchive(!showArchive)}
              className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showArchive ? "bg-white text-black border-white" : "border-[rgba(255,255,255,0.2)] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.05)]")}
            >
              {showArchive ? "Hide Archive" : "Show Archive"}
            </button>
          </div>
        </div>
        <button onClick={() => { setTaskToEdit(null); setIsPanelOpen(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.25)] text-[#F87171] text-sm font-medium hover:bg-[rgba(248,113,113,0.2)] transition-colors">
          <Plus className="w-4 h-4" /> Add task
        </button>
      </div>

      {!showArchive && (
        <ContextualTip 
          id="do_space" 
          title="Tasks that move" 
          description="This is the Do space. Tasks are organized by deadline. Keep tasks small and actionable. Focus on starting them, not finishing them." 
        />
      )}

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-all capitalize",
              categoryFilter === cat
                ? "bg-white text-black border-white font-semibold"
                : "border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.25)]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" />
        </div>
      ) : showArchive ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white mb-4">Archived Tasks</h2>
          {archivedTasks.length === 0 ? (
            <div className="text-sm text-[rgba(255,255,255,0.2)] text-center py-8 border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl">
              No completed tasks yet.
            </div>
          ) : (
            archivedTasks.filter(t => categoryFilter === "all" || t.category === categoryFilter).map(task => (
              <GlassCard key={task.id} className="p-4 opacity-70 hover:opacity-100 transition-opacity flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] capitalize" style={{ color: CATEGORY_COLORS[task.category] ?? "rgba(255,255,255,0.35)" }}>
                      {task.category}
                    </span>
                    <span className="text-[10px] text-[rgba(255,255,255,0.35)]">
                      • Completed {new Date((task as any).completed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white line-through">{task.title}</p>
                </div>
                <button 
                  onClick={() => restoreTask(task.id)}
                  className="px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-xs font-medium text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                >
                  Restore
                </button>
              </GlassCard>
            ))
          )}
        </div>
      ) : (
        <div className={cn(
          "gap-6",
          isBoardView ? "grid grid-cols-1 md:grid-cols-3 items-start" : "flex flex-col space-y-8 max-w-2xl mx-auto"
        )}>
          {overdue.length > 0 || isBoardView ? <Column title="Overdue" tasks={overdue} accent="#F87171" icon={Zap} /> : null}
          {today.length > 0 || isBoardView ? <Column title="Today" tasks={today} accent="#FBBF24" icon={Clock} /> : null}
          {upcoming.length > 0 || isBoardView ? <Column title="Upcoming" tasks={upcoming} accent="#2DD4BF" icon={Calendar} /> : null}
        </div>
      )}

      <TaskAddPanel isOpen={isPanelOpen} onClose={handleClosePanel} onTaskAdded={fetchTasks} taskToEdit={taskToEdit} />
      <FocusSession task={focusTask} onClose={() => setFocusTask(null)} onComplete={fetchTasks} />
    </div>
  );
}
