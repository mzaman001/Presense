"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Play, ArrowRight, CheckCircle2, Users, MessageSquare, Compass, Loader2, FolderInput, X, Check, Sparkles, Flame } from "lucide-react";
import { m } from "framer-motion";
import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { useRealtime } from "@/hooks/useRealtime";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

interface TaskItem {
  id: string;
  title: string;
  priority: number | null;
  deadline: string | null;
  first_step: string | null;
  status: string;
  snoozed_until: string | null;
  completed_at: string | null;
  category: string | null;
  user_id: string;
}

interface PersonItem {
  id: string;
  name: string;
  next_meeting: string | null;
}

interface ThreadItem {
  id: string;
  title: string;
  color_accent: string;
}

interface ExploreItem {
  id: string;
  title: string;
  type: string;
}

function RitualStatusBadge({ userSettings }: { userSettings: any }) {
  const setActiveRitual = useAppStore(s => s.setActiveRitual);
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA");
  const morningDone = userSettings?.last_ritual_date === todayStr;
  const eveningDone = userSettings?.last_evening_ritual_date === todayStr;
  const shutdownTime = userSettings?.shutdown_time || "17:00:00";
  const shutdownHour = shutdownTime.split(':')[0];
  const shutdownAmPm = parseInt(shutdownHour) >= 12 ? `${parseInt(shutdownHour) === 12 ? 12 : parseInt(shutdownHour) - 12} PM` : `${parseInt(shutdownHour)} AM`;
  const streak = userSettings?.ritual_streak || 0;

  const StreakBadge = () => streak > 0 ? (
    <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold">
      <Flame className="w-3.5 h-3.5" /> {streak}
    </span>
  ) : null;

  if (morningDone && eveningDone) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--status-done)]/10 border border-[var(--status-done)]/20 mt-3 text-[12px] text-[var(--status-done)] font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Day complete — Great work today
        <StreakBadge />
      </div>
    );
  }

  if (morningDone) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-dim)]/10 border border-[var(--accent-border)] mt-3 text-[12px] text-[var(--text-3)] font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" /> Day planned <span className="mx-1 opacity-50">•</span> Evening review at {shutdownAmPm}
        <StreakBadge />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <button 
        onClick={() => setActiveRitual('morning')}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-colors text-[12px] text-orange-400 font-medium group"
      >
        <Sparkles className="w-3.5 h-3.5" /> You haven't planned your day yet 
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>
      <StreakBadge />
    </div>
  );
}

export default function HomeDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { userSettings, setUserSettings, setActiveTimer } = useAppStore();
  
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [activeRouteItem, setActiveRouteItem] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.dropdown-trigger')) return;
      setActiveRouteItem(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const { data: dashboardData, isLoading: loading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const now = new Date();
      const currentDay = now.getDay() || 7;
      const mondayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDay + 1, 0, 0, 0, 0);

      const [tasksRes, inboxRes, peopleRes, threadsRes, exploresRes, doneRes, sessionsRes] = await Promise.all([
        supabase.from("items").select("*").in("status", ["active", "overdue"]),
        supabase.from("items").select("*").eq("status", "inbox"),
        supabase.from("people").select("*"),
        supabase.from("threads").select("*"),
        supabase.from("explores").select("*").is("revisited_at", null),
        supabase.from("items").select("*").eq("status", "done").gte("completed_at", mondayStart.toISOString()).order("completed_at", { ascending: false }),
        supabase.from("session_logs").select("*").gte("completed_at", mondayStart.toISOString()).eq("type", "work")
      ]);

      let upNext: TaskItem[] = [];
      if (tasksRes.data) {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        const sorted = tasksRes.data.sort((a: any, b: any) => {
          const aPrio = a.priority ?? 4;
          const bPrio = b.priority ?? 4;

          const aOverdue = a.deadline && new Date(a.deadline) < now;
          const bOverdue = b.deadline && new Date(b.deadline) < now;
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;

          const aToday = a.deadline && new Date(a.deadline).getTime() >= todayStart && new Date(a.deadline).getTime() < todayStart + 86400000;
          const bToday = b.deadline && new Date(b.deadline).getTime() >= todayStart && new Date(b.deadline).getTime() < todayStart + 86400000;

          if (aPrio === 1 && bPrio !== 1) return -1;
          if (bPrio === 1 && aPrio !== 1) return 1;

          if (aToday && aPrio === 2 && (!bToday || bPrio !== 2)) return -1;
          if (bToday && bPrio === 2 && (!aToday || aPrio !== 2)) return 1;

          if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          if (a.deadline) return -1;
          if (b.deadline) return 1;

          return aPrio - bPrio;
        });
        upNext = sorted.filter((t: any) => !t.snoozed_until || new Date(t.snoozed_until) <= now);
      }

      return {
        tasks: upNext,
        inboxItems: inboxRes.data || [],
        people: peopleRes.data || [],
        threads: threadsRes.data || [],
        explores: exploresRes.data || [],
        doneTasks: doneRes.data || [],
        pomodorosThisWeek: sessionsRes.data ? sessionsRes.data.length : 0
      };
    }
  });

  const { tasks = [], inboxItems = [], people = [], threads = [], explores = [], doneTasks = [], pomodorosThisWeek = 0 } = dashboardData || {};

  const completeTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCompleting(id);
    try {
      const { error } = await supabase.from('items').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Task completed');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {
      toast.error('Failed to complete task');
    } finally {
      setCompleting(null);
    }
  };

  const routeInboxItem = async (id: string, space: string) => {
    if (!space) return;
    try {
      if (space === 'do') {
        await supabase.from('items').update({ status: 'active' }).eq('id', id);
      } else if (space === 'explore') {
        const item = inboxItems.find((i: any) => i.id === id);
        if (!item) return;
        await supabase.from('items').delete().eq('id', id);
        await supabase.from('explores').insert({ user_id: item.user_id, title: item.title, type: 'other', status: 'active' });
      } else if (space === 'think') {
        const item = inboxItems.find((i: any) => i.id === id);
        if (!item) return;
        await supabase.from('items').delete().eq('id', id);
        await supabase.from('threads').insert({ user_id: item.user_id, title: item.title, status: 'active', color_accent: '#2DD4BF' });
      }
      toast.success(`Routed to ${space}`);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {
      toast.error('Failed to route item');
    }
  };

  const dismissInboxItem = async (id: string) => {
    try {
      await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {
      toast.error('Failed to dismiss');
    }
  };

  const refreshData = () => queryClient.invalidateQueries({ queryKey: ['dashboard'] });

  useRealtime("items", refreshData);
  useRealtime("people", refreshData);
  useRealtime("threads", refreshData);
  useRealtime("explores", refreshData);

  const primaryTask = tasks.length > 0 ? tasks[0] : null;

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-3)]" /></div>;
  }

  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";

  let heroReason = "Earliest deadline";
  if (primaryTask) {
    if (primaryTask.deadline && new Date(primaryTask.deadline).getTime() < new Date().getTime()) {
      heroReason = `Overdue since ${new Date(primaryTask.deadline).toLocaleDateString()}`;
    } else if (primaryTask.priority === 1) {
      heroReason = "Highest priority";
    } else if (primaryTask.deadline) {
      const hours = (new Date(primaryTask.deadline).getTime() - new Date().getTime()) / 3600000;
      if (hours < 3 && hours > 0) heroReason = `Due in ${Math.round(hours)} hours`;
      else heroReason = `Due ${new Date(primaryTask.deadline).toLocaleDateString()}`;
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-page-greeting text-[var(--text-1)]">
            {greeting}
            <span className="text-[var(--text-3)]">
              {userSettings?.display_name ? `, ${userSettings.display_name.split(' ')[0]}` : ', you'}.
            </span>
          </h1>
          <RitualStatusBadge userSettings={userSettings} />
        </div>
        <button 
          onClick={() => setShowReview(!showReview)}
          className={cn("text-xs px-4 py-2 rounded-xl transition-colors font-medium border", showReview ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
        >
          {showReview ? "Back to Dashboard" : "Week in Review"}
        </button>
      </header>

      <ContextualTip 
        id="home" 
        title="Welcome to your External Brain" 
        description="This is your dashboard. The 'Focus Now' task is chosen based on the most urgent deadline. Use the '+' button below anytime to capture new things." 
      />

      {showReview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <GlassCard className="p-6 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-light text-[var(--color-text-1)] mb-1">{doneTasks.length}</div>
              <div className="text-xs text-[var(--color-text-3)]">Tasks Completed</div>
            </GlassCard>
            <GlassCard className="p-6 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-light text-[var(--color-text-1)] mb-1">{pomodorosThisWeek}</div>
              <div className="text-xs text-[var(--color-text-3)]">Focus Sessions</div>
            </GlassCard>
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-1)] mb-4">Completed This Week</h2>
          {doneTasks.length === 0 ? (
            <GlassCard className="p-8 text-center text-[var(--color-text-3)] border-dashed">
              No tasks completed in the last 7 days.
            </GlassCard>
          ) : (
            doneTasks.map((task: any) => (
              <GlassCard key={task.id} className="p-4 flex justify-between items-center opacity-80">
                <div>
                  <h4 className="text-card-title text-[var(--text-1)] line-through">{task.title}</h4>
                  <p className="text-xs text-[var(--color-text-3)] mt-0.5">
                    Completed {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-[var(--color-do)]" />
              </GlassCard>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Inbox banner removed, using Inbox Section below Up Next instead */}

      {/* Focus Now Hero Card */}
      {primaryTask ? (
        <div className="glass-card-hero relative overflow-hidden p-8">
          <div className="absolute top-0 right-0 p-8">
            <div 
              className="w-24 h-24 rounded-full relative animate-spin-slow" 
              style={{ 
                background: 'conic-gradient(from 0deg, var(--accent), var(--accent-hot), var(--accent-deep), var(--accent))', 
                filter: 'blur(1px)',
                WebkitMaskImage: 'radial-gradient(circle, transparent 40px, black 41px)',
                maskImage: 'radial-gradient(circle, transparent 40px, black 41px)'
              }}
            />
          </div>
          
          <div className="relative z-10 p-10 flex flex-col items-center justify-center text-center h-full">
            <span className="text-[10px] font-bold tracking-widest text-[var(--accent)] uppercase mb-4 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20">
              ⚡ FOCUS NOW
            </span>
            <h2 className="text-3xl font-medium text-[var(--text-1)] mb-1">{primaryTask.title}</h2>
            <p className="text-label text-[var(--text-3)] mb-4">{heroReason}</p>
            <p className="text-[var(--text-2)] mb-6 text-lg">{primaryTask.first_step}</p>
            
            <button onClick={() => setActiveTimer({ taskId: primaryTask.id, taskTitle: primaryTask.title })} className="btn-primary">
              <Play className="w-4 h-4 fill-[currentColor]" />
              <span>Start session &rarr;</span>
            </button>
            <button 
              onClick={async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                const snoozedTask = primaryTask;
                
                // Save current states for rollback
                const previousDashboard = queryClient.getQueryData(['dashboard']);
                const previousTasks = queryClient.getQueryData(['tasks']);
                
                // Optimistic UI updates
                queryClient.setQueryData(['dashboard'], (old: any) => {
                  if (!old) return old;
                  return {
                    ...old,
                    tasks: old.tasks.filter((t: any) => t.id !== snoozedTask.id)
                  };
                });
                queryClient.setQueryData(['tasks'], (old: any[] | undefined) => 
                  old?.filter(t => t.id !== snoozedTask.id) ?? []
                );
                
                try {
                  useAppStore.getState().markMutation();
                  const { error } = await supabase.from("items").update({ snoozed_until: tomorrow.toISOString() }).eq("id", snoozedTask.id);
                  if (error) throw error;

                  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                  queryClient.invalidateQueries({ queryKey: ['tasks'] });
                  
                  toast.success("Snoozed until tomorrow", {
                    duration: 8000,
                    action: {
                      label: "Undo",
                      onClick: async () => {
                        const currentDashboard = queryClient.getQueryData(['dashboard']);
                        const currentTasks = queryClient.getQueryData(['tasks']);
                        
                        // Optimistic restore (put task back)
                        queryClient.setQueryData(['dashboard'], (old: any) => {
                          if (!old) return old;
                          return {
                            ...old,
                            tasks: [...old.tasks, { ...snoozedTask, snoozed_until: null }]
                          };
                        });
                        queryClient.setQueryData(['tasks'], (old: any[] | undefined) => 
                          old ? [...old, { ...snoozedTask, snoozed_until: null }] : []
                        );
                        
                        try {
                          useAppStore.getState().markMutation();
                          const { error: undoError } = await supabase.from("items").update({ snoozed_until: null }).eq("id", snoozedTask.id);
                          if (undoError) throw undoError;
                          
                          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                          queryClient.invalidateQueries({ queryKey: ['tasks'] });
                          toast.success("Snooze reversed");
                        } catch {
                          // Rollback undo
                          queryClient.setQueryData(['dashboard'], currentDashboard);
                          queryClient.setQueryData(['tasks'], currentTasks);
                          toast.error("Failed to undo snooze");
                        }
                      }
                    }
                  });
                } catch (error) {
                  // Rollback snooze
                  queryClient.setQueryData(['dashboard'], previousDashboard);
                  queryClient.setQueryData(['tasks'], previousTasks);
                  toast.error("Failed to snooze task");
                }
              }}
              className="mt-4 text-xs text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors underline decoration-dashed underline-offset-4"
            >
              Snooze until tomorrow
            </button>
          </div>
        </div>
      ) : (
        <GlassCard className="p-8 text-center text-[var(--color-text-3)] border-dashed">
          No active tasks. Take a breath.
        </GlassCard>
      )}

      {/* Bento 4-card overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/do" className="block">
          <GlassCard hoverable className="h-full flex flex-col justify-between">
            <CheckCircle2 size={20} strokeWidth={1.5} className="text-[var(--color-do)] mb-4 shrink-0" />
            <div>
              <div className="text-2xl font-light text-[var(--color-text-1)]"><AnimatedNumber value={tasks.length} /></div>
              <div className="text-xs text-[var(--color-text-3)] mt-1">Active Tasks</div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/remember/people" className="block">
          <GlassCard hoverable className="h-full flex flex-col justify-between">
            <Users size={20} strokeWidth={1.5} className="text-[var(--color-people)] mb-4 shrink-0" />
            <div>
              <div className="text-2xl font-light text-[var(--color-text-1)]"><AnimatedNumber value={people.length} /></div>
              <div className="text-xs text-[var(--color-text-3)] mt-1">People Tracked</div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/think" className="block">
          <GlassCard hoverable className="h-full flex flex-col justify-between">
            <MessageSquare size={20} strokeWidth={1.5} className="text-[var(--color-think)] mb-4 shrink-0" />
            <div>
              <div className="text-2xl font-light text-[var(--color-text-1)]"><AnimatedNumber value={threads.length} /></div>
              <div className="text-xs text-[var(--color-text-3)] mt-1">Open Threads</div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/explore" className="block">
          <GlassCard hoverable className="h-full flex flex-col justify-between">
            <Compass size={20} strokeWidth={1.5} className="text-[var(--color-explore)] mb-4 shrink-0" />
            <div>
              <div className="text-2xl font-light text-[var(--color-text-1)]"><AnimatedNumber value={explores.length} /></div>
              <div className="text-xs text-[var(--color-text-3)] mt-1">Saved Items</div>
            </div>
          </GlassCard>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 mt-6">
        <GlassCard className="flex-1 p-5 flex items-center justify-between w-full">
          <span className="text-card-title text-[var(--color-text-3)] uppercase tracking-wider">Pomodoros this week</span>
          <span className="text-2xl font-semibold text-[var(--color-text-1)]"><AnimatedNumber value={pomodorosThisWeek} /></span>
        </GlassCard>
        <GlassCard className="flex-1 p-5 flex items-center justify-between w-full">
          <span className="text-card-title text-[var(--color-text-3)] uppercase tracking-wider">Tasks completed this week</span>
          <span className="text-2xl font-semibold text-[var(--color-text-1)]"><AnimatedNumber value={doneTasks.length} /></span>
        </GlassCard>
      </div>

      {userSettings?.daily_briefing !== false && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Today's Tasks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-[var(--text-1)]">Up Next</h3>
            <Link href="/do" className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] flex items-center gap-1">
              {tasks.length > 1 ? `${Math.min(5, tasks.length - 1)} of ${tasks.length - 1} tasks shown — ` : ""}View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {tasks.slice(1, 6).map((task, i) => (
            <m.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <GlassCard
                className="p-4 flex justify-between items-start cursor-pointer hover:scale-[1.01] transition-transform gap-3"
                onClick={() => { setTaskToEdit(task); setIsTaskPanelOpen(true); }}
              >
                <button
                  onClick={(e) => completeTask(e, task.id)}
                  className={cn("checkbox mt-0.5", completing === task.id && "checked")}
                >
                  {completing === task.id && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <h4 className="text-card-title text-[var(--text-1)]">{task.title}</h4>
                  <p className="text-xs text-[var(--color-text-3)] mt-0.5 truncate">{task.first_step}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-3)] shrink-0 ml-2 mt-1" />
              </GlassCard>
            </m.div>
          ))}
          {tasks.length <= 1 && (
            <div className="p-4 border border-dashed border-[var(--color-border)] rounded-2xl text-center text-sm text-[var(--color-text-3)]">
              All caught up!
            </div>
          )}
        </div>

        {/* Inbox Section */}
        {inboxItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-section-title text-[var(--text-1)]">Inbox</h3>
                <div className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold tracking-wider">
                  {inboxItems.length} NEW
                </div>
              </div>
              <Link href="/inbox" className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {inboxItems.map((item: any) => (
              <GlassCard key={item.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-amber-500/5 border-amber-500/20 group">
                <p className="text-card-title text-[var(--text-1)] flex-1">{item.title}</p>
                <div className="flex items-center gap-2 w-full md:w-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                  <div className="relative flex-1 md:flex-none">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveRouteItem(activeRouteItem === item.id ? null : item.id); }}
                      className="btn-secondary w-full dropdown-trigger"
                    >
                      <FolderInput className="w-3.5 h-3.5" />
                      Route it
                    </button>
                    {activeRouteItem === item.id && (
                      <div className="dropdown-panel absolute top-full mt-2 right-0 w-48 p-1 z-50 animate-in fade-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { routeInboxItem(item.id, 'do'); setActiveRouteItem(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Do (Task)
                        </button>
                        <button onClick={() => { routeInboxItem(item.id, 'think'); setActiveRouteItem(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-teal-400" /> Think (Thread)
                        </button>
                        <button onClick={() => { routeInboxItem(item.id, 'explore'); setActiveRouteItem(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <Compass className="w-4 h-4 text-amber-400" /> Explore (Saved)
                        </button>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => dismissInboxItem(item.id)}
                    className="btn-icon !bg-transparent !border-transparent hover:!bg-red-500/10 hover:!text-red-400 shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Removed People Briefing Preview */}
      </div>
      )}
      </>
      )}
      <TaskAddPanel isOpen={isTaskPanelOpen} onClose={() => { setIsTaskPanelOpen(false); setTimeout(() => setTaskToEdit(null), 300); }} onTaskAdded={refreshData} taskToEdit={taskToEdit} />
    </div>
  );
}

