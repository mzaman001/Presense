"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Plus, Loader2, Sparkles, Pin } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { cn } from "@/lib/utils";

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
  const supabase = createClient();
  const setCaptureModalOpen = useAppStore((state) => state.setCaptureModalOpen);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = threads.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.entries && t.entries.some(e => e.text.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const fetchThreads = useCallback(async () => {
    const { data } = await supabase
      .from("threads")
      .select("*")
      .eq("status", showArchive ? "archived" : "active")
      .order("is_pinned", { ascending: false })
      .order("last_updated", { ascending: false });
    setThreads(data ?? []);
    setLoading(false);
  }, [supabase, showArchive]);

  useEffect(() => {
    async function ensureDailyNote() {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const title = `Daily Note: ${dateStr}`;
      const { data: existing } = await supabase.from("threads").select("id").eq("title", title).eq("status", "active").maybeSingle();
      
      if (!existing) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("threads").insert({
            user_id: user.id,
            title,
            color_accent: "#FBBF24",
            is_pinned: true
          });
        }
      }
    }
    ensureDailyNote();
    fetchThreads();
  }, [fetchThreads, supabase]);

  useRealtime("threads", fetchThreads);

  const timeAgo = (dt: string) => {
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
    
    const { data: existing } = await supabase
      .from("threads")
      .select("id")
      .eq("title", title)
      .eq("status", "active")
      .maybeSingle();
      
    if (existing) {
      window.location.href = `/think/${existing.id}`;
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from("threads").insert({
      user_id: user.id,
      title,
      color_accent: "#FBBF24",
      is_pinned: true
    }).select().single();

    if (!error && data) {
      window.location.href = `/think/${data.id}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-medium text-white tracking-tight">Think</h1>
            <button 
              onClick={() => setShowArchive(!showArchive)}
              className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showArchive ? "bg-white text-black border-white" : "border-[rgba(255,255,255,0.2)] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.05)]")}
            >
              {showArchive ? "Hide Archive" : "Show Archive"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            placeholder="Search threads..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="hidden md:block w-48 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none focus:border-[#2DD4BF]"
          />
          <button onClick={handleDailyNote} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.25)] text-[#FBBF24] text-sm font-medium hover:bg-[rgba(251,191,36,0.2)] transition-colors hidden sm:flex">
            <Sparkles className="w-4 h-4" /> Daily Note
          </button>
          <button onClick={() => setCaptureModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(45,212,191,0.12)] border border-[rgba(45,212,191,0.25)] text-[#2DD4BF] text-sm font-medium hover:bg-[rgba(45,212,191,0.2)] transition-colors">
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
        <input 
          type="text" 
          placeholder="Search threads..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none focus:border-[#2DD4BF]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" />
        </div>
      ) : (
        <>
          {filteredThreads.filter(t => t.stale_prompt).length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#2DD4BF]" />
                <h2 className="text-sm font-semibold text-white">Stale Threads</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredThreads.filter(t => t.stale_prompt).map((thread, i) => (
                  <motion.div key={thread.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link href={`/think/${thread.id}`}>
                      <GlassCard className="p-4 bg-[rgba(45,212,191,0.05)] border-[rgba(45,212,191,0.2)] hover:bg-[rgba(45,212,191,0.1)] transition-colors cursor-pointer h-full">
                        <div className="flex items-start gap-3">
                          <div className="w-1 self-stretch rounded-full shrink-0 bg-[#2DD4BF]" />
                          <div>
                            <p className="text-sm font-semibold text-white mb-1">{thread.title}</p>
                            <p className="text-xs text-[#2DD4BF] font-medium leading-relaxed">{thread.stale_prompt}</p>
                          </div>
                        </div>
                      </GlassCard>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {filteredThreads.length === 0 ? (
            <GlassCard className="p-8 text-center mt-6">
              <p className="text-sm text-[rgba(255,255,255,0.3)]">No threads yet. Capture a thought — &ldquo;What if I...&rdquo; or &ldquo;I wonder...&rdquo;</p>
            </GlassCard>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-white mb-3 mt-6">All Threads</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredThreads.map((thread, i) => (
            <motion.div key={thread.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={`/think/${thread.id}`}>
                <GlassCard className="p-5 hover:scale-[1.01] transition-transform cursor-pointer h-full">
                  <div className="flex items-start gap-3">
                    <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: thread.color_accent }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {thread.is_pinned && <Pin className="w-3.5 h-3.5 text-[#2DD4BF] fill-current" />}
                        <p className="text-sm font-semibold text-white leading-snug">{thread.title}</p>
                      </div>
                      {thread.entries?.length > 0 && (
                        <p className="text-xs text-[rgba(255,255,255,0.4)] line-clamp-2 leading-relaxed">
                          {thread.entries[thread.entries.length - 1]?.text}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[11px] text-[rgba(255,255,255,0.3)]">
                          {thread.entries?.length ?? 0} entries · Updated {timeAgo(thread.last_updated)}
                        </span>
                        {thread.stale_prompt && (
                          <span className="flex items-center gap-1 text-[10px] text-[#2DD4BF]">
                            <Sparkles className="w-3 h-3" /> Revisit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
