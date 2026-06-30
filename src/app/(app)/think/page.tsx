"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { m } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Plus, Loader2, Sparkles, Pin, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useAppStore } from "@/store/useAppStore";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Thread {
  id: string;
  title: string;
  color_accent: string;
  entries: Array<{ text: string; created_at: string; starred?: boolean }>;
  stale_prompt: string | null;
  last_updated: string;
  status: string;
  is_pinned: boolean;
}

export default function ThinkPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const setPrefetchedThread = useAppStore(s => s.setPrefetchedThread);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = threads.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.entries && t.entries.some(e => e.text.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const fetchThreads = useCallback(async () => {
    let query = supabase
      .from("threads")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("last_updated", { ascending: false });

    if (showTrash) query = query.eq("status", "deleted");
    else if (showArchive) query = query.eq("status", "archived");
    else query = query.eq("status", "active");

    const { data } = await query;
    setThreads(data ?? []);
    setLoading(false);
  }, [supabase, showArchive, showTrash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchThreads();
  }, [fetchThreads]);

  useRealtime("threads", fetchThreads);

  const timeAgo = (dt: string) => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(dt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const handleDailyNote = async () => {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const title = `Daily Note: ${dateStr}`;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Try insert first — the unique index on (user_id, title) prevents duplicates.
    // If a race condition causes a conflict, fall back to fetching the existing thread.
    const { data: inserted } = await supabase
      .from("threads")
      .insert({
        user_id: user.id,
        title,
        color_accent: "#FBBF24",
        is_pinned: true
      })
      .select("id")
      .single();

    if (inserted) {
      router.push(`/think/${inserted.id}`);
      return;
    }

    // Conflict or other error — fetch the existing daily note
    const { data: existingThreads } = await supabase
      .from("threads")
      .select("id")
      .eq("title", title)
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (existingThreads && existingThreads.length > 0) {
      router.push(`/think/${existingThreads[0].id}`);
    }
  };

  const handleNewThread = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from("threads").insert({
      user_id: user.id,
      title: "Untitled Thread",
      color_accent: "var(--accent)",
      is_pinned: false
    }).select().single();

    if (!error && data) {
      router.push(`/think/${data.id}`);
    }
  };

  const togglePin = async (e: React.MouseEvent, thread: Thread) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!thread.is_pinned) {
      const pinnedCount = threads.filter(t => t.is_pinned).length;
      if (pinnedCount >= 3) {
        toast.error('You can pin up to 3 threads');
        return;
      }
    }
    
    // Optimistic update
    setThreads(current => {
      const updated = current.map(t => 
        t.id === thread.id ? { ...t, is_pinned: !t.is_pinned } : t
      );
      // Re-sort exactly like fetchThreads does
      return updated.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
      });
    });
    
    const { error } = await supabase
      .from("threads")
      .update({ is_pinned: !thread.is_pinned })
      .eq("id", thread.id);
      
    if (error) {
      toast.error('Failed to update pin status');
      fetchThreads(); // revert on error
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-medium text-[var(--color-text-1)] tracking-tight">Think</h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setShowArchive(false); setShowTrash(false); setThreads([]); }}
                className={cn("text-xs px-3 py-1 rounded-full border transition-colors", !showArchive && !showTrash ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
              >
                Active
              </button>
              <button 
                onClick={() => { setShowArchive(true); setShowTrash(false); setThreads([]); }}
                className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showArchive ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
              >
                Archive
              </button>
              <button 
                onClick={() => { setShowTrash(true); setShowArchive(false); setThreads([]); }}
                className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showTrash ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
              >
                Trash
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input 
              type="text" 
              placeholder="Search threads..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-search hidden md:block !w-48"
            />
          </div>
          <button onClick={handleDailyNote} className="btn-secondary !text-[#FBBF24] !border-[rgba(251,191,36,0.25)] !bg-[rgba(251,191,36,0.12)] hover:!bg-[rgba(251,191,36,0.2)] hidden sm:flex">
            <Sparkles className="w-4 h-4" /> Daily Note
          </button>
          <button onClick={handleNewThread} className="btn-secondary !text-[var(--accent)] !border-[var(--accent-border)] !bg-[var(--accent-dim)] hover:!bg-[var(--accent-dim-hover)]">
            <Plus className="w-4 h-4" /> New thread
          </button>
        </div>
      </div>

      <ContextualTip 
        id="think_space" 
        title="Thoughts that stay" 
        description="This is the Think space. Create threads for ideas, journals, or long-term thoughts. We will resurface old threads to prompt new insights." 
      />

      <div className="md:hidden">
        <div className="relative">
          <Search size={13} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input 
            type="text" 
            placeholder="Search threads..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-search w-full md:hidden"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-6">
          <PageSkeleton count={4} type="card" />
        </div>
      ) : (
        <>
          {filteredThreads.filter(t => t.stale_prompt).length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--color-text-1)]">Stale Threads</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredThreads.filter(t => t.stale_prompt).map((thread, i) => (
                  <m.div key={thread.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link href={`/think/${thread.id}`} onClick={() => setPrefetchedThread(thread.id, thread)}>
                      <GlassCard className="p-4 bg-[var(--surface-input)] border-[var(--accent-dim-hover)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer h-full">
                        <div className="flex items-start gap-3">
                          <div className="w-1 self-stretch rounded-full shrink-0 bg-[var(--accent)]" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-text-1)] mb-1">{thread.title}</p>
                            <p className="text-xs text-[var(--accent)] font-medium leading-relaxed">{thread.stale_prompt}</p>
                          </div>
                        </div>
                      </GlassCard>
                    </Link>
                  </m.div>
                ))}
              </div>
            </div>
          )}

          {filteredThreads.length === 0 ? (
            <GlassCard className="p-12 text-center mt-6 flex flex-col items-center justify-center border-dashed border-[rgba(255,255,255,0.08)]">
              <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-[var(--color-text-3)]" />
              </div>
              <h3 className="text-[var(--color-text-1)] font-medium mb-2">No threads yet</h3>
              <p className="text-sm text-[var(--color-text-3)] max-w-sm mb-6">Capture a thought — &ldquo;What if I...&rdquo; or &ldquo;I wonder...&rdquo; to start expanding your ideas.</p>
              <button 
                onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
                className="btn-primary gap-2"
              >
                <Plus size={16} /> New Thought
              </button>
            </GlassCard>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-1)] mb-3 mt-6">All Threads</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredThreads.map((thread, i) => (
            <m.div key={thread.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={`/think/${thread.id}`} onClick={() => setPrefetchedThread(thread.id, thread)}>
                <GlassCard className="p-5 hover:scale-[1.01] transition-transform cursor-pointer h-full group relative">
                  {!showArchive && !showTrash && (
                    <button 
                      onClick={(e) => togglePin(e, thread)}
                      className={cn(
                        "absolute right-3 top-3 p-1.5 rounded-lg transition-all",
                        thread.is_pinned 
                          ? "opacity-100 text-[var(--accent)] hover:bg-[var(--surface-hover)]" 
                          : "opacity-0 group-hover:opacity-100 text-[var(--text-4)] hover:text-[var(--text-2)] hover:bg-[var(--color-surface)]"
                      )}
                    >
                      <Pin size={14} strokeWidth={1.5} className={cn(thread.is_pinned && "fill-current")} />
                    </button>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: thread.color_accent }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {!showArchive && !showTrash && thread.is_pinned && <Pin className="w-3.5 h-3.5 text-[var(--accent)] fill-current" />}
                        <p className="text-sm font-semibold text-[var(--color-text-1)] leading-snug pr-6">{thread.title}</p>
                      </div>
                      {thread.entries?.length > 0 && (
                        <p className="text-xs text-[var(--color-text-3)] line-clamp-2 leading-relaxed">
                          {thread.entries[thread.entries.length - 1]?.text}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[11px] text-[var(--color-text-3)]">
                          {thread.entries?.length ?? 0} entries · Updated {timeAgo(thread.last_updated)}
                        </span>
                        {thread.stale_prompt && (
                          <span className="flex items-center gap-1 text-[10px] text-[var(--accent)]">
                            <Sparkles className="w-3 h-3" /> Revisit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </m.div>
          ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

