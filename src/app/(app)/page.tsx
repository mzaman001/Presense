"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Play, ArrowRight, CheckCircle2, Users, MessageSquare, Compass, Loader2 } from "lucide-react";
import Link from "next/link";
import { FocusSession } from "@/components/features/FocusSession";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { useRealtime } from "@/hooks/useRealtime";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function HomeDashboard() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [explores, setExplores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusTask, setFocusTask] = useState<any | null>(null);
  const { userSettings, setUserSettings } = useAppStore();
  const [taskToEdit, setTaskToEdit] = useState<any | null>(null);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);

  const [inboxItems, setInboxItems] = useState<any[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [doneTasks, setDoneTasks] = useState<any[]>([]);

  const [pomodorosThisWeek, setPomodorosThisWeek] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [tasksRes, inboxRes, peopleRes, threadsRes, exploresRes, settingsRes, doneRes, sessionsRes] = await Promise.all([
      supabase.from("items").select("*").in("status", ["active", "overdue", "inbox"]).or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`),
      supabase.from("items").select("*").eq("status", "inbox"),
      supabase.from("people").select("*"),
      supabase.from("threads").select("*"),
      supabase.from("explores").select("*").is("revisited_at", null),
      supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
      supabase.from("items").select("*").eq("status", "done").gte("completed_at", sevenDaysAgo.toISOString()).order("completed_at", { ascending: false }),
      supabase.from("session_logs").select("*").gte("completed_at", sevenDaysAgo.toISOString()).eq("session_type", "work")
    ]);
    
    if (tasksRes.data) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      const sorted = tasksRes.data.sort((a, b) => {
        const aOverdue = a.deadline && new Date(a.deadline) < now;
        const bOverdue = b.deadline && new Date(b.deadline) < now;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        const aToday = a.deadline && new Date(a.deadline).getTime() >= todayStart && new Date(a.deadline).getTime() < todayStart + 86400000;
        const bToday = b.deadline && new Date(b.deadline).getTime() >= todayStart && new Date(b.deadline).getTime() < todayStart + 86400000;

        if (aToday && a.priority === "P1" && (!bToday || b.priority !== "P1")) return -1;
        if (bToday && b.priority === "P1" && (!aToday || a.priority !== "P1")) return 1;

        if (aToday && a.priority === "P2" && (!bToday || b.priority !== "P2")) return -1;
        if (bToday && b.priority === "P2" && (!aToday || a.priority !== "P2")) return 1;

        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (a.deadline) return -1;
        if (b.deadline) return 1;

        const pWeight = { P1: 1, P2: 2, P3: 3, P4: 4 };
        return (pWeight[a.priority as keyof typeof pWeight] || 4) - (pWeight[b.priority as keyof typeof pWeight] || 4);
      });
      setTasks(sorted);
    }
    if (inboxRes.data) setInboxItems(inboxRes.data);
    if (peopleRes.data) setPeople(peopleRes.data);
    if (threadsRes.data) setThreads(threadsRes.data);
    if (exploresRes.data) setExplores(exploresRes.data);
    if (settingsRes.data) setUserSettings(settingsRes.data);
    if (doneRes.data) setDoneTasks(doneRes.data);
    if (sessionsRes.data) setPomodorosThisWeek(sessionsRes.data.length);
    setLoading(false);
  }, [supabase, setUserSettings]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useRealtime("items", fetchDashboardData);
  useRealtime("people", fetchDashboardData);
  useRealtime("threads", fetchDashboardData);
  useRealtime("explores", fetchDashboardData);

  const primaryTask = tasks.length > 0 ? tasks[0] : null;

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-3)]" /></div>;
  }

  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-page-title text-3xl">{greeting}{userSettings?.display_name ? `, ${userSettings.display_name.split(' ')[0]}` : ''}.</h1>
          {userSettings?.daily_briefing !== false && (
            <p className="text-[var(--color-text-3)] mt-1">Here is your focus for today.</p>
          )}
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
            doneTasks.map(task => (
              <GlassCard key={task.id} className="p-4 flex justify-between items-center opacity-80">
                <div>
                  <h4 className="text-sm font-medium text-[var(--color-text-1)] line-through">{task.title}</h4>
                  <p className="text-xs text-[var(--color-text-3)] mt-0.5">
                    Completed {new Date(task.completed_at).toLocaleDateString()}
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-[var(--color-do)]" />
              </GlassCard>
            ))
          )}
        </div>
      ) : (
        <>
          {inboxItems.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-1)]">{inboxItems.length} {inboxItems.length === 1 ? "thing needs" : "things need"} sorting</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400/80">We weren't sure where to put these.</p>
                </div>
              </div>
              <Link href="/do?filter=inbox" className="px-4 py-2 bg-amber-400 dark:bg-amber-500 text-amber-950 text-xs font-bold rounded-xl hover:bg-amber-500 dark:hover:bg-amber-400 transition-colors">
                Sort Inbox
              </Link>
            </div>
          )}

      {/* Focus Now Hero Card */}
      {primaryTask ? (
        <GlassCard className="relative overflow-hidden p-8 border-[var(--color-accent)]/30">
          <div className="absolute top-0 right-0 p-8">
            <div 
              className="w-24 h-24 rounded-full relative animate-spin-slow" 
              style={{ 
                background: 'conic-gradient(from 0deg, var(--color-accent), var(--color-accent-hot), var(--color-accent-deep), var(--color-accent))', 
                filter: 'blur(1px)',
                WebkitMaskImage: 'radial-gradient(circle, transparent 40px, black 41px)',
                maskImage: 'radial-gradient(circle, transparent 40px, black 41px)'
              }}
            />
          </div>
          
          <div className="relative z-10 p-10 flex flex-col items-center justify-center text-center h-full">
            <span className="text-[10px] font-bold tracking-widest text-[var(--color-accent)] uppercase mb-4 px-3 py-1 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
              ⚡ FOCUS NOW
            </span>
            <h2 className="text-3xl font-medium text-[var(--color-text-1)] mb-2">{primaryTask.title}</h2>
            <p className="text-[var(--color-text-2)] mb-6 text-lg">{primaryTask.first_step}</p>
            
            <button onClick={() => setFocusTask(primaryTask)} className="flex items-center gap-2 bg-[var(--color-text-1)] text-[var(--color-background)] px-6 py-3 rounded-full font-medium hover:scale-[1.02] transition-transform">
              <Play className="w-4 h-4 fill-black" />
              <span className="text-sm font-semibold tracking-wide">Start {userSettings?.pomodoro_duration || 25}m Timer</span>
            </button>
            <button 
              onClick={async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                await supabase.from("items").update({ snoozed_until: tomorrow.toISOString() }).eq("id", primaryTask.id);
                // The realtime listener will hide it since snoozed_until is now in the future
                toast.success("Snoozed until tomorrow");
              }}
              className="mt-4 text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors underline decoration-dashed underline-offset-4"
            >
              Snooze until tomorrow
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-8 text-center text-[var(--color-text-3)] border-dashed">
          No active tasks. Take a breath.
        </GlassCard>
      )}

      {/* Bento 4-card overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/do" className="block">
          <GlassCard hoverable className="h-full flex flex-col justify-between">
            <CheckCircle2 className="w-6 h-6 text-[var(--color-do)] mb-4" />
            <div>
              <div className="text-2xl font-light text-[var(--color-text-1)]">{tasks.length}</div>
              <div className="text-xs text-[var(--color-text-3)] mt-1">Active Tasks</div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/people" className="block">
          <GlassCard hoverable className="h-full flex flex-col justify-between">
            <Users className="w-6 h-6 text-[var(--color-people)] mb-4" />
            <div>
              <div className="text-2xl font-light text-[var(--color-text-1)]">{people.filter(p => p.next_meeting).length}</div>
              <div className="text-xs text-[var(--color-text-3)] mt-1">Meetings Today</div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/think" className="block">
          <GlassCard hoverable className="h-full flex flex-col justify-between">
            <MessageSquare className="w-6 h-6 text-[var(--color-think)] mb-4" />
            <div>
              <div className="text-2xl font-light text-[var(--color-text-1)]">{threads.length}</div>
              <div className="text-xs text-[var(--color-text-3)] mt-1">Open Threads</div>
            </div>
          </GlassCard>
        </Link>
        <Link href="/explore" className="block">
          <GlassCard hoverable className="h-full flex flex-col justify-between">
            <Compass className="w-6 h-6 text-[var(--color-explore)] mb-4" />
            <div>
              <div className="text-2xl font-light text-[var(--color-text-1)]">{explores.length}</div>
              <div className="text-xs text-[var(--color-text-3)] mt-1">Saved Items</div>
            </div>
          </GlassCard>
        </Link>
      </div>

      {userSettings?.daily_briefing !== false && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Today's Tasks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-lg">Up Next</h3>
            <Link href="/do" className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] flex items-center gap-1">
              {tasks.length > 1 ? `${Math.min(5, tasks.length - 1)} of ${tasks.length - 1} tasks shown — ` : ""}View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {tasks.slice(1, 6).map(task => (
            <GlassCard
              key={task.id}
              className="p-4 flex justify-between items-center cursor-pointer hover:scale-[1.01] transition-transform"
              onClick={() => { setTaskToEdit(task); setIsTaskPanelOpen(true); }}
            >
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-[var(--color-text-1)]">{task.title}</h4>
                <p className="text-xs text-[var(--color-text-3)] mt-0.5 truncate">{task.first_step}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--color-text-3)] shrink-0 ml-2" />
            </GlassCard>
          ))}
          {tasks.length <= 1 && (
            <div className="p-4 border border-dashed border-[var(--color-border)] rounded-2xl text-center text-sm text-[var(--color-text-3)]">
              All caught up!
            </div>
          )}
        </div>

        {/* People Briefing Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-lg">Upcoming Meeting</h3>
            <Link href="/people" className="text-xs text-[var(--color-text-3)] hover:text-[var(--color-text-1)] flex items-center gap-1">
              View briefing <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {people.filter(p => p.next_meeting).map(person => (
            <GlassCard key={person.id} className="p-5 border-[var(--color-people)]/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-medium text-[var(--color-text-1)] text-sm" style={{ backgroundColor: 'var(--color-people)' }}>
                  {person.initials}
                </div>
                <div>
                  <h4 className="text-base font-medium text-[var(--color-text-1)]">{person.name}</h4>
                  <p className="text-xs text-[var(--color-people)]">{person.next_meeting}</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-[var(--color-text-2)]">
                {(person.notes || []).slice(0, 2).map((note: any, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--color-people)]">•</span>
                    {note.text || note}
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </div>
      )}
      </>
      )}
      <FocusSession task={focusTask} onClose={() => setFocusTask(null)} onComplete={fetchDashboardData} />
      <TaskAddPanel isOpen={isTaskPanelOpen} onClose={() => { setIsTaskPanelOpen(false); setTimeout(() => setTaskToEdit(null), 300); }} onTaskAdded={fetchDashboardData} taskToEdit={taskToEdit} />
    </div>
  );
}
