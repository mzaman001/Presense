"use client";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";


import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { TaskCard } from "@/components/features/TaskCard";
import { CalendarView } from "@/components/features/calendar/CalendarView";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Clock, Play, Check, Zap, Calendar, Wind, CheckCircle2 } from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useHaptics } from "@/hooks/useHaptics";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useAppStore } from "@/store/useAppStore";
import { DEFAULT_DO_COLORS } from "@/lib/constants";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

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


const Column = React.memo(({ 
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
  peopleMap?: Record<string, { initials: string | null, color: string | null, name: string }>;
}) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4" style={{ color: accent }} />
      <h2 className="text-sm font-semibold text-[var(--color-text-1)]">{title}</h2>
      {colTasks.length > 0 && (
        <Badge variant={title.toLowerCase() as any}>
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
            <m.div
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
            </m.div>
          ))
        )}
      </AnimatePresence>
    </div>
  </div>
));
Column.displayName = "Column";

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
  const [initialDeadline, setInitialDeadline] = useState<Date | null>(null);

  const userSettings = useAppStore(s => s.userSettings);
  const setActiveTimer = useAppStore(s => s.setActiveTimer);
  const isBoardView = userSettings?.default_view === "board";
  const haptics = useHaptics();

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
    const map: Record<string, { initials: string | null, color: string | null, name: string }> = {};
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

  const [viewMode, setViewMode] = useState<"board" | "today" | "calendar">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("presense_do_view");
      if (saved === "today" || saved === "board" || saved === "calendar") return saved as "board" | "today" | "calendar";
    }
    return "board";
  });

  const toggleViewMode = (mode: "board" | "today" | "calendar") => {
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
    setArchivedTasks((data as Task[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (showArchive) fetchArchived();
  }, [fetchArchived, showArchive]);

  useRealtime("items", fetchTasks);
  useRealtime("people", fetchPeopleList);

  const completeTask = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // Set completing state — TaskCard shows the checkmark animation
    setCompleting(id);
    haptics.success();
    
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
    } catch (err: unknown) {
      setCompleting(null);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.error("Failed to complete task", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  }, [haptics, queryClient, supabase, fetchTasks, showArchive, fetchArchived]);

  const restoreTask = async (id: string) => {
    try {
      useAppStore.getState().markMutation();
      await supabase.from("items").update({ status: "active", completed_at: null }).eq("id", id);
      fetchTasks();
      fetchArchived();
      toast.success("Task restored");
    } catch (err: unknown) {
      toast.error("Failed to restore task");
    }
  };

  const openEditPanel = useCallback((task: Task) => {
    setTaskToEdit(task);
    setInitialDeadline(null);
    setIsPanelOpen(true);
  }, []);

  const openCreatePanelAt = (deadline: Date) => {
    setTaskToEdit(null);
    setInitialDeadline(deadline);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => {
      setTaskToEdit(null);
      setInitialDeadline(null);
    }, 300);
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
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d > now && d.toDateString() !== now.toDateString();
  });
  const someday = filtered.filter((t) => !t.deadline);

  const doCats = userSettings?.do_categories || ["work", "study", "personal", "errand", "health"];
  const CATEGORIES = ["all", ...doCats];




  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader 
        title="Do" 
        actions={
          <Button variant="secondary" onClick={() => { setTaskToEdit(null); setInitialDeadline(null); setIsPanelOpen(true); }} className="!text-[var(--accent)] !border-[var(--accent-border)] !bg-[var(--accent-dim)] hover:!bg-[var(--accent-dim-hover)]">
            <UiIcon className="w-4 h-4" icon={Plus} /> Add task
          </Button>
        }
      >
        <SegmentedControl
          options={[
            { label: "Board", value: "board" },
            { label: "Today", value: "today" },
            { label: "Calendar", value: "calendar" }
          ]}
          value={viewMode}
          onChange={(val) => toggleViewMode(val as any)}
        />
        <button 
          onClick={() => setShowArchive(!showArchive)}
          className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showArchive ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
        >
          {showArchive ? "Hide Archive" : "Show Archive"}
        </button>
      </PageHeader>

      {!showArchive && viewMode !== "calendar" && (
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
            <EmptyState
              icon={CheckCircle2}
              title="No completed tasks yet"
              description="When you finish tasks, they will appear here in your archive."
              className="bg-transparent border-[rgba(255,255,255,0.08)]"
            />
          ) : (
            archivedTasks.filter(t => categoryFilter === "all" || t.category === categoryFilter).map(task => (
              <GlassCard key={task.id} className="p-4 opacity-70 hover:opacity-100 transition-opacity flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-caption font-semibold text-[rgba(255,255,255,0.35)] capitalize" style={{ color: (userSettings?.do_category_colors?.[task.category] || DEFAULT_DO_COLORS[task.category]) ?? "rgba(255,255,255,0.35)" }}>
                      {task.category}
                    </span>
                    <span className="text-caption text-[rgba(255,255,255,0.35)]">
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
      ) : viewMode === "calendar" ? (
        <CalendarView tasks={tasks} onEditTask={openEditPanel} onCreateTaskAt={openCreatePanelAt} categoryFilter={categoryFilter} />
      ) : viewMode === "today" ? (
        <div className={cn(
          "gap-6",
          isBoardView ? "grid grid-cols-1 md:grid-cols-2 items-start max-w-3xl mx-auto" : "flex flex-col space-y-8 max-w-2xl mx-auto"
        )}>
           {overdue.length > 0 && <Column title="Overdue" tasks={overdue} accent="var(--status-overdue)" icon={Zap} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} />}
           <Column title="Today" tasks={today} accent="var(--status-today)" icon={Clock} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} />
          {overdue.length === 0 && today.length === 0 && (
            <EmptyState
              icon={Wind}
              title="You're all caught up"
              description="No tasks due today. Take a well-deserved break, or plan ahead for tomorrow."
              className="md:col-span-2"
              action={
                <Button variant="primary" 
                  onClick={() => { setTaskToEdit(null); setInitialDeadline(null); setIsPanelOpen(true); }}
                  className="gap-2"
                >
                  <UiIcon size={16} icon={Plus} /> Add Task
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className={cn(
          "gap-6",
          isBoardView ? "grid grid-cols-1 md:grid-cols-3 items-start" : "flex flex-col space-y-8 max-w-2xl mx-auto"
        )}>
           {overdue.length > 0 || isBoardView ? <Column title="Overdue" tasks={overdue} accent="var(--status-overdue)" icon={Zap} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} /> : null}
           {today.length > 0 || isBoardView ? <Column title="Today" tasks={today} accent="var(--status-today)" icon={Clock} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} /> : null}
           {upcoming.length > 0 || isBoardView ? <Column title="Upcoming" tasks={upcoming} accent="var(--status-upcoming)" icon={Calendar} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} /> : null}
           {someday.length > 0 || isBoardView ? <Column title="Someday" tasks={someday} accent="var(--status-someday)" icon={Calendar} completing={completing} completeTask={completeTask} openEditPanel={openEditPanel} fetchTasks={fetchTasks} newTaskIds={newTaskIds} peopleMap={peopleMap} /> : null}
           {overdue.length === 0 && today.length === 0 && upcoming.length === 0 && someday.length === 0 && (
             <EmptyState
               icon={Wind}
               title="You're all caught up"
               description="No tasks in this view. Take a well-deserved break, or plan ahead."
               className="md:col-span-3"
               action={
                 <Button variant="primary" 
                   onClick={() => { setTaskToEdit(null); setInitialDeadline(null); setIsPanelOpen(true); }}
                   className="gap-2 mx-auto"
                 >
                   <UiIcon size={16} icon={Plus} /> Add Task
                 </Button>
               }
             />
           )}
        </div>
      )}

      <TaskAddPanel isOpen={isPanelOpen} onClose={handleClosePanel} onTaskAdded={fetchTasks} taskToEdit={taskToEdit} initialDeadline={initialDeadline} />
    </div>
  );

}
