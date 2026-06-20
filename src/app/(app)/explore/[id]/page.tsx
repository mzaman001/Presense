"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { createClient } from "@/lib/supabase";
import { ArrowLeft, Loader2, Save, Trash2, Archive, ExternalLink, X, Plus, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";
import { motion, AnimatePresence } from "framer-motion";

const PRESET_TYPES = ["link", "quote", "concept", "book", "movie", "article", "course", "podcast", "other"];

export default function ExploreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  
  // Custom type support
  const [type, setType] = useState("other");
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // Pill component for tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  const [note, setNote] = useState("");
  const [status, setStatus] = useState("active");
  const [linkedThreadId, setLinkedThreadId] = useState<string | null>(null);
  
  const [threads, setThreads] = useState<any[]>([]);
  const [isThreadDropdownOpen, setIsThreadDropdownOpen] = useState(false);

  const fetchItem = useCallback(async () => {
    const { data: item } = await supabase.from("explores").select("*").eq("id", id).single();
    if (item) {
      setTitle(item.title);
      setUrl(item.url || "");
      
      if (PRESET_TYPES.includes(item.type)) {
        setType(item.type);
        setIsCustomType(false);
      } else {
        setType("custom");
        setIsCustomType(true);
        setCustomTypeInput(item.type);
      }

      setTags(item.tags || []);
      setNote(item.note || "");
      setStatus(item.status || "active");
      setLinkedThreadId(item.linked_thread_id);

      if (!item.revisited_at) {
        supabase.from("explores").update({ revisited_at: new Date().toISOString() }).eq("id", id).then();
      }
    }

    const { data: threadData } = await supabase.from("threads").select("id, title").eq("status", "active");
    setThreads(threadData || []);
    
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchItem(); }, [fetchItem]);

  // Close dropdowns on outside click
  useEffect(() => {
    const closeAll = () => { setIsTypeDropdownOpen(false); setIsThreadDropdownOpen(false); };
    document.addEventListener("click", closeAll);
    return () => document.removeEventListener("click", closeAll);
  }, []);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = newTag.trim().replace(/^#/, "");
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalType = isCustomType ? (customTypeInput.trim() || "other") : type;
      const { error } = await supabase.from("explores").update({
        title,
        url: url || null,
        type: finalType,
        note,
        tags,
        linked_thread_id: linkedThreadId || null
      }).eq("id", id);
      if (error) throw error;
      toast.success("Saved");
      router.push("/explore");
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      const newStatus = status === "archived" ? "active" : "archived";
      const { error } = await supabase.from("explores").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
      toast.success(newStatus === "archived" ? "Archived" : "Restored");
      router.push("/explore");
    } catch (err: any) {
      toast.error("Failed to archive", { description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this? It will be permanently removed in 30 days.")) return;
    try {
      const { error } = await supabase.from("explores").update({ status: "deleted" }).eq("id", id);
      if (error) throw error;
      toast.success("Deleted (30-day trash)");
      router.push("/explore");
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-3)]" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Link href="/explore" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Explore
        </Link>
        <div className="flex items-center gap-2">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-1)] hover:bg-[var(--color-surface)] transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={handleArchive} className="p-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-1)] hover:bg-[var(--color-surface)] transition-colors">
            <Archive className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="p-2 rounded-lg bg-[rgba(248,113,113,0.1)] text-[#F87171] hover:bg-[rgba(248,113,113,0.2)] transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <GlassCard className="p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Type</label>
              
              <div className="relative">
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsTypeDropdownOpen(!isTypeDropdownOpen); setIsThreadDropdownOpen(false); }}
                  className="w-full flex items-center justify-between bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-1)] hover:border-[var(--accent)] transition-colors"
                >
                  <span className="capitalize">{isCustomType ? (customTypeInput || "Custom") : type}</span>
                  <ChevronDown className="w-4 h-4 text-[var(--color-text-3)]" />
                </button>
                <AnimatePresence>
                  {isTypeDropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      className="absolute left-0 top-full mt-2 w-full p-1 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] shadow-2xl z-50 flex flex-col gap-0.5"
                    >
                      {PRESET_TYPES.map(preset => (
                        <button 
                          key={preset} type="button"
                          onClick={(e) => { e.stopPropagation(); setType(preset); setIsCustomType(false); setIsTypeDropdownOpen(false); }}
                          className="text-left px-3 py-2 text-sm rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--color-text-1)] capitalize"
                        >
                          {preset}
                        </button>
                      ))}
                      <div className="my-1 border-t border-[var(--color-border)]" />
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsCustomType(true); setIsTypeDropdownOpen(false); }}
                        className="text-left px-3 py-2 text-sm rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--accent)] flex items-center gap-2"
                      >
                        <Plus className="w-3 h-3" /> Custom Type
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {isCustomType && (
                <motion.input
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  autoFocus
                  placeholder="Enter custom type..."
                  value={customTypeInput}
                  onChange={(e) => setCustomTypeInput(e.target.value)}
                  className="w-full mt-3 bg-[var(--color-surface)] border border-[var(--accent)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--accent)] transition-colors"
                />
              )}
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Tags</label>
              <div className="p-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] focus-within:border-[var(--accent)] transition-colors flex flex-wrap gap-2">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--accent-dim)] text-[var(--accent)] text-xs font-medium">
                    {t}
                    <button type="button" onClick={() => handleRemoveTag(t)} className="hover:text-[var(--color-text-1)] transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Add tag and press Enter..."
                  className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Link to Think Thread</label>
            <div className="relative">
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsThreadDropdownOpen(!isThreadDropdownOpen); setIsTypeDropdownOpen(false); }}
                className="w-full flex items-center justify-between bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-1)] hover:border-[var(--accent)] transition-colors"
              >
                <span className="truncate pr-4">
                  {linkedThreadId ? threads.find(t => t.id === linkedThreadId)?.title || "Unknown Thread" : "-- No Thread Linked --"}
                </span>
                <ChevronDown className="w-4 h-4 text-[var(--color-text-3)] shrink-0" />
              </button>
              <AnimatePresence>
                {isThreadDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 top-full mt-2 w-full p-1 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] shadow-2xl z-50 flex flex-col gap-0.5 max-h-48 overflow-y-auto no-scrollbar"
                  >
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLinkedThreadId(null); setIsThreadDropdownOpen(false); }}
                      className="text-left px-3 py-2 text-sm rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--color-text-3)]"
                    >
                      -- No Thread Linked --
                    </button>
                    {threads.map(t => (
                      <button 
                        key={t.id} type="button"
                        onClick={(e) => { e.stopPropagation(); setLinkedThreadId(t.id); setIsThreadDropdownOpen(false); }}
                        className="text-left px-3 py-2 text-sm rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--color-text-1)] truncate"
                      >
                        {t.title}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Notes</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center w-full gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--color-background)] font-semibold hover:bg-[#F59E0B] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
