"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowLeft, Loader2, Send, Sparkles, Trash2, Archive, Pin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ThreadEntry {
  text: string;
  created_at: string;
  starred?: boolean;
}

interface Thread {
  id: string;
  title: string;
  color_accent: string;
  entries: ThreadEntry[];
  stale_prompt: string | null;
  status: string;
  is_pinned: boolean;
}

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEntry, setNewEntry] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkedExplores, setLinkedExplores] = useState<any[]>([]);

  const fetchThread = useCallback(async () => {
    const { data: threadData } = await supabase.from("threads").select("*").eq("id", id).single();
    setThread(threadData);
    
    const { data: exploresData } = await supabase.from("explores").select("*").eq("linked_thread_id", id).in("status", ["active", "archived"]);
    setLinkedExplores(exploresData || []);
    
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchThread(); }, [fetchThread]);
  useRealtime("threads", fetchThread);
  useRealtime("explores", fetchThread);

  const handleTogglePin = async () => {
    if (!thread) return;
    try {
      const newPinStatus = !thread.is_pinned;
      const { error } = await supabase.from("threads").update({ is_pinned: newPinStatus }).eq("id", thread.id);
      if (error) throw error;
      setThread({ ...thread, is_pinned: newPinStatus });
      toast.success(newPinStatus ? "Thread pinned" : "Thread unpinned");
    } catch (error: any) {
      toast.error("Failed to pin thread", { description: error.message });
    }
  };

  const handleArchive = async () => {
    if (!thread) return;
    try {
      const newStatus = thread.status === "archived" ? "active" : "archived";
      const { error } = await supabase.from("threads").update({ status: newStatus }).eq("id", thread.id);
      if (error) throw error;
      toast.success(newStatus === "archived" ? "Thread archived" : "Thread restored");
      router.push("/think");
    } catch (error: any) {
      toast.error("Failed to archive thread", { description: error.message });
    }
  };

  const handleDelete = async () => {
    if (!thread) return;
    if (!confirm("Delete this thread? It will be permanently removed in 30 days.")) return;
    try {
      const { error } = await supabase.from("threads").update({ status: "deleted" }).eq("id", id);
      if (error) throw error;
      toast.success("Deleted (30-day trash)");
      router.push("/think");
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim() || !thread) return;
    setSaving(true);
    
    try {
      const entry = { text: newEntry.trim(), created_at: new Date().toISOString() };
      const updatedEntries = [...(thread.entries || []), entry];
      
      const { error } = await supabase.from("threads").update({ 
        entries: updatedEntries,
        last_updated: new Date().toISOString(),
        stale_prompt: null // Clear stale prompt if they revisit
      }).eq("id", thread.id);

      if (error) throw error;
      
      setThread({ ...thread, entries: updatedEntries, stale_prompt: null });
      setNewEntry("");
      toast.success("Added to thread");
    } catch (error: any) {
      console.error("Think error:", error);
      toast.error("Failed to save thought", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" /></div>;
  }

  if (!thread) {
    return <div className="text-center py-20 text-[rgba(255,255,255,0.5)]">Thread not found.</div>;
  }

  const handleDeleteEntry = async (indexToDelete: number) => {
    if (!thread || !confirm("Delete this entry?")) return;
    try {
      const updatedEntries = thread.entries.filter((_, i) => i !== indexToDelete);
      const { error } = await supabase.from("threads").update({ entries: updatedEntries }).eq("id", thread.id);
      if (error) throw error;
      setThread({ ...thread, entries: updatedEntries });
      toast.success("Entry deleted");
    } catch (err: any) {
      toast.error("Failed to delete entry", { description: err.message });
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-32">
      <Link href="/think" className="inline-flex items-center gap-2 text-sm text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Think
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: thread.color_accent }} />
          <div>
            <h1 className="text-[26px] font-semibold text-white tracking-tight leading-snug">{thread.title}</h1>
            {thread.stale_prompt && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-[rgba(45,212,191,0.1)] border border-[rgba(45,212,191,0.2)] rounded-md">
                <Sparkles className="w-3.5 h-3.5 text-[#2DD4BF]" />
                <span className="text-xs font-medium text-[#2DD4BF]">{thread.stale_prompt}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleTogglePin}
            className={cn("p-2 rounded-lg transition-colors", thread.is_pinned ? "bg-[rgba(45,212,191,0.1)] text-[#2DD4BF]" : "hover:bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.5)]")}
            title={thread.is_pinned ? "Unpin thread" : "Pin thread"}
          >
            <Pin className="w-4 h-4" />
          </button>
          <button 
            onClick={handleArchive}
            className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.5)] transition-colors"
            title={thread.status === "archived" ? "Restore thread" : "Archive thread"}
          >
            <Archive className="w-4 h-4" />
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-[rgba(248,113,113,0.1)] text-[rgba(255,255,255,0.5)] hover:text-[#F87171] transition-colors"
            title="Delete thread"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {linkedExplores.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-3">Linked Resources</h3>
          <div className="flex flex-wrap gap-3">
            {linkedExplores.map(item => (
              <Link key={item.id} href={`/explore/${item.id}`}>
                <GlassCard className="px-4 py-2 flex items-center gap-2 hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                  <span className="text-sm text-white font-medium">{item.title}</span>
                  <span className="text-[10px] uppercase text-[rgba(255,255,255,0.3)] ml-2">{item.type}</span>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {(thread.entries || []).map((entry, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <GlassCard className="p-5 border-l-2 border-l-transparent hover:border-l-[#2DD4BF] transition-all group relative">
              <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap pr-8">{entry.text}</p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-[rgba(255,255,255,0.3)]">
                  {new Date(entry.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <button 
                onClick={() => handleDeleteEntry(i)}
                className="absolute top-4 right-4 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-[rgba(248,113,113,0.1)] text-[rgba(255,255,255,0.3)] hover:text-[#F87171]"
                title="Delete entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Fixed bottom input for thoughts */}
      <div className="fixed bottom-0 left-0 right-0 md:pl-[220px] p-4 bg-gradient-to-t from-[#0B0914] via-[#0B0914]/90 to-transparent z-40">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleAddEntry} className="relative">
            <textarea
              placeholder="Continue the thought..."
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddEntry(e);
              }}
              className="w-full bg-[rgba(255,255,255,0.03)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl px-5 py-4 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none focus:border-[#2DD4BF] focus:bg-[rgba(45,212,191,0.03)] transition-all pr-14 resize-none h-24 shadow-2xl"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <span className="text-[10px] text-[rgba(255,255,255,0.2)] font-mono hidden md:inline">Cmd+Enter</span>
              <button type="submit" disabled={!newEntry.trim() || saving} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(45,212,191,0.15)] text-[#2DD4BF] hover:bg-[rgba(45,212,191,0.25)] transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
