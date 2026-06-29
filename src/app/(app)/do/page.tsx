"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { TaskCard } from "@/components/features/TaskCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Clock, Play, Check, Zap, Calendar, Wind, CheckCircle2 } from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useAppStore } from "@/store/useAppStore";
import { DEFAULT_DO_COLORS } from "@/lib/constants";
import { PageSkeleton } from "@/components/ui/Skeleton";

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
  linked_people_ids?: string[] | null;
}


const Column = ({ 
  title, 
  tasks: colTasks, 
  accent, 
  icon: Icon,
  completing,
  completeTask,
  openEditPanel,
  fetchTasks,
  newTaskIds,
  peopleMap
}: { 
  title: string; 
  tasks: Task[]; 
  accent: string; 
  icon: React.ElementType;
  completing: string | null;
  completeTask: (e: React.MouseEvent, id: string) => void;
  openEditPanel: (task: Task) => void;
  fetchTasks: () => void;
  newTaskIds: Set<string>;
  peopleMap?: Record<string, { initials: string, color: string, name: string }>;
}) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4" style={{ color: accent }} />
      <h2 className="text-sm font-semibold text-[var(--color-text-1)]">{title}</h2>
      {colTasks.length > 0 && (
        <Badge style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>
          {colTasks.length}
        </Badge>
      )}
    </div>
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {colTasks.length === 0 ? (
          <div className="text-sm text-[var(--color-text-3)] text-center py-8 border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl">
            Nothing here
          </div>
        ) : (
          colTasks.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={newTaskIds.has(t.id) ? { opacity: 0, y: -12, scale: 0.97 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <TaskCard 
                task={t} 
                completing={completing}
                completeTask={completeTask}
                openEditPanel={openEditPanel}
                fetchTasks={fetchTasks}
                peopleMap={peopleMap}
              />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  </div>
);

export default function DoPage() {
  const supabase = useMemo(() => createClient(), []);
  const initialFilter = "all";
  
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>(initialFilter);
  const [completing, setCompleting] = useState<string | null>(null);
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());
  const prevTaskIdsRef = useRef<Set<string>>(new Set());
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const userSettings = useAppStore(s => s.userSettings);
  const setActiveTimer = useAppStore(s => s.setActiveTimer);
  const isBoardView = userSettings?.default_view === "board";

  const { data: tasks = [], isLoading: loading, refetch: fetchTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .in("status", ["active", "overdue"])
        .order("priority", { ascending: true, nullsFirst: false })
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Task[];
    }
  });

  const { data: peopleList = [], refetch: fetchPeopleList } = useQuery({
    queryKey: ["people_minimal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("id, name, initials, color");
      if (error) throw error;
      return data || [];
    }
  });

  const peopleMap = useMemo(() => {
    const map: Record<string, { initials: string, color: string, name: string }> = {};
    for (const p of peopleList) {
      map[p.id] = p;
    }
    return map;
  }, [peopleList]);

  useEffect(() => {
    const currentIds = new Set(tasks.map(t => t.id));
    const added = tasks.filter(t => !prevTaskIdsRef.current.has(t.id)).map(t => t.id);
    if (added.length > 0) {
      setNewTaskIds(prev => new Set([...prev, ...added]));
      setTimeout(() => {
        setNewTaskIds(prev => {
          const next = new Set(prev);
          added.forEach(id => next.delete(id));
          return next;
        });
      }, 400);
    }
    prevTaskIdsRef.current = currentIds;
  }, [tasks]);

  const [viewMode, setViewMode] = useState<"board" | "today">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("presense_do_view");
      if (saved === "today" || saved === "board") return saved as "board" | "today";
    }
    return "board";
  });

  const toggleViewMode = (mode: "board" | "today") => {
    setViewMode(mode);
    localStorage.setItem("presense_do_view", mode);
  };

  const [showArchive, setShowArchive] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);

  const fetchArchived = useCallback(async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("status", "done")
      .order("completed_at", { ascending: false });
    setArchivedTasks(data ?? []);
  }, [supabase]);

  useEffect(() => {
    if (showArchive) fetchArchived();
  }, [fetchArchived, showArchive]);

  useRealtime("items", fetchTasks);
  useRealtime("people", fetchPeopleList);

  const completeTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // Set completing state — TaskCard shows the checkmark animation
    setCompleting(id);
    
    // Delay removal so AnimatePresence can play the exit animation
    setTimeout(() => {
      queryClient.setQueryData<Task[]>(["tasks"], old => old?.filter(t => t.id !== id));
      setCompleting(null);
    }, 400);
    
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
      setCompleting(null);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.error("Failed to complete task", { description: err.message });
    }
  };

  const restoreTask = async (id: string) => {
    try {
      useAppStore.getState().markMutation();
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
    const isActiveOrOverdue = t.status === "active" || t.status === "overdue";
    if (categoryFilter === "all") return isActiveOrOverdue;
    if (categoryFilter === "inbox") return t.status === "inbox";
    if (categoryFilter === "today") {
      if (!t.deadline || !isActiveOrOverdue) return false;
      const d = new Date(t.deadline);
      const now = new Date();
      return (d <= now || d.toDateString() === now.toDateString());
    }
    return t.category === categoryFilter && isActiveOrOverdue;
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

  const doCats = userSettings?.do_categories || ["work", "study", "personal", "errand", "health"];
  const CATEGORIES = ["all", ...doCats];




  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-medium text-[var(--color-text-1)] tracking-tight">Do</h1>
            <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full p-0.5">
              <button
                onClick={() => toggleViewMode("board")}
                className={cn("px-4 py-1 text-xs font-semibold rounded-full transition-all", viewMode === "board" ? "bg-[var(--color-text-1)] text-[var(--color-background)] shadow" : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]")}
              >
                All
              </button>
              <button
                onClick={() => toggleViewMode("today")}
                className={cn("px-4 py-1 text-xs font-semibold rounded-full transition-all", viewMode === "today" ? "bg-[var(--color-text-1)] text-[var(--color-background)] shadow" : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]")}
              >
                Today
              </button>
            </div>
            <button 
              onClick={() => setShowArchive(!showArchive)}
              className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showArchive ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
            >
              {showArchive ? "Hide Archive" : "Show Archive"}
            </button>
          </div>
        </div>
        <button onClick={() => { setTaskToEdit(null); setIsPanelOpen(true); }} className="btn-secondary !text-[var(--accent)] !border-[var(--accent-border)] !bg-[var(--accent-dim)] hover:!bg-[var(--accent-dim-hover)]">
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
                ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)] font-semibold"
                : "border-[var(--color-border)] text-[var(--color-text-3)] hover:border-[var(--color-border)]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSkeleton count={5} type="task" />
      ) : showArchive ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-1)] mb-4">Archived Tasks</h2>
          {archivedTasks.length === 0 ? (
            <GlassCard className="p-12 text-center flex flex-col items-center justify-center border-dashed border-[rgba(255,255,255,0.08)] bg-transparent">
              <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-[var(--color-text-3)]" />
              </div>
              <h3 className="text-[var(--color-text-1)] font-medium mb-2">No completed tasks yet</h3>
              <p className="text-sm text-[var(--color-text-3)] max-w-sm">When you finish tasks, they will appear here in your archive.</p>
            </GlassCard>
          ) : (
            archivedTasks.filter(t => categoryFilter === "all" || t.category === categoryFilter).map(task => (
              <GlassCard key={task.id} className="p-4 opacity-70 hover:opacity-100 transition-opacity flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] capitalize" style={{ color: (userSettings?.do_category_colors?.[task.category] || DEFAULT_DO_COLORS[task.category]) ?? "rgba(255,255,255,0.35)" }}>
                      {task.category}
                    </span>
                    <span className="text-[10px] text-[rgba(255,255,255,0.35)]">
                      • Completed {new Date((task as any).completed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text-1)] line-through">{task.title}</p>
                </div>
                <button 
                  onClick={() => restoreTask(task.id)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-1)] hover:bg-[var(--color-surface)] transition-colors"
                >
                  Restore
                </button>
              </GlassCard>
            ))
          )}
        </div>
      ) : viewMode === "today" ? (
        <div className={cn(
          "gap-6",
          isBoardView ? "grid grid-cols-1 md:grid-cols-2 items-start max-w-3xl mx-auto" : "flex flex-col space-y-8 max-w-2xl mx-auto"
        )}>
           {overdue.length > 0 && <Column title="Overdue" tasks={overdue} accent="#F87171" icon={Zap} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} />}
           <Column title="Today" tasks={today} accent="#FBBF24" icon={Clock} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} />
          {overdue.length === 0 && today.length === 0 && (
            <GlassCard className="p-12 text-center md:col-span-2 flex flex-col items-center justify-center border-dashed border-[rgba(255,255,255,0.08)] bg-transparent">
              <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-4">
                <Wind className="w-6 h-6 text-[var(--color-text-3)]" />
              </div>
              <h3 className="text-[var(--color-text-1)] font-medium mb-2">You're all caught up!</h3>
              <p className="text-sm text-[var(--color-text-3)] max-w-sm mb-6">No tasks due today. Take a breath or plan ahead.</p>
              <button 
                onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
                className="btn-secondary gap-2"
              >
                <Plus size={16} /> Add Task
              </button>
            </GlassCard>
          )}
        </div>
      ) : (
        <div className={cn(
          "gap-6",
          isBoardView ? "grid grid-cols-1 md:grid-cols-3 items-start" : "flex flex-col space-y-8 max-w-2xl mx-auto"
        )}>
           {overdue.length > 0 || isBoardView ? <Column title="Overdue" tasks={overdue} accent="#F87171" icon={Zap} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} /> : null}
           {today.length > 0 || isBoardView ? <Column title="Today" tasks={today} accent="#FBBF24" icon={Clock} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} /> : null}
           {upcoming.length > 0 || isBoardView ? <Column title="Upcoming" tasks={upcoming} accent="#2DD4BF" icon={Calendar} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} /> : null}
           {overdue.length === 0 && today.length === 0 && upcoming.length === 0 && (
             <GlassCard className="p-12 text-center md:col-span-3 flex flex-col items-center justify-center border-dashed border-[rgba(255,255,255,0.08)] bg-transparent">
               <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-4">
                 <Wind className="w-6 h-6 text-[var(--color-text-3)]" />
               </div>
               <h3 className="text-[var(--color-text-1)] font-medium mb-2">You're all caught up!</h3>
               <p className="text-sm text-[var(--color-text-3)] max-w-sm mb-6">No tasks in this view. Take a breath or plan ahead.</p>
               <button 
                 onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
                 className="btn-secondary gap-2 mx-auto"
               >
                 <Plus size={16} /> Add Task
               </button>
             </GlassCard>
           )}
        </div>
      )}

      <TaskAddPanel isOpen={isPanelOpen} onClose={handleClosePanel} onTaskAdded={fetchTasks} taskToEdit={taskToEdit} />
    </div>
  );

}
