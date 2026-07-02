"use client";
import { logger } from "@/lib/logger";

import React, { useEffect, useState, useCallback, use } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { m, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowLeft, Loader2, Send, Sparkles, Trash2, Archive, Pin, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { cn, extractMentions } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useAppStore } from "@/store/useAppStore";

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
  const prefetchedThreads = useAppStore(s => s.prefetchedThreads);
  const prefetched = prefetchedThreads[id] as Thread | undefined;
  const [thread, setThread] = useState<Thread | null>(prefetched || null);
  const [loading, setLoading] = useState(!prefetched);
  const [newEntry, setNewEntry] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkedExplores, setLinkedExplores] = useState<any[]>([]);

  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverSearch, setPopoverSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchPeople() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("people").select("id, name").eq("user_id", user.id);
      if (data) {
        setPeople(data);
      }
    }
    fetchPeople();
  }, [supabase]);

  const filteredPeople = React.useMemo(() => {
    return people.filter(p =>
      p.name.toLowerCase().includes(popoverSearch.toLowerCase())
    );
  }, [people, popoverSearch]);

  const handleSelectPerson = useCallback((person: { id: string; name: string }) => {
    if (!textareaRef.current) return;
    const val = newEntry;
    const selectionStart = textareaRef.current.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const textAfterCursor = val.slice(selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    const mentionText = `@[${person.name}](${person.id})`;
    const newVal = val.slice(0, lastAtIndex) + mentionText + " " + textAfterCursor;
    setNewEntry(newVal);
    setShowPopover(false);

    // Focus textarea and move cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursorPosition = lastAtIndex + mentionText.length + 1;
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  }, [newEntry]);

  const handleInputChange = (val: string) => {
    setNewEntry(val);

    if (!textareaRef.current) return;
    const selectionStart = textareaRef.current.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === " " || textBeforeCursor[lastAtIndex - 1] === "\n")) {
      const search = textBeforeCursor.slice(lastAtIndex + 1);
      if (!search.includes(" ") && !search.includes("\n")) {
        setShowPopover(true);
        setPopoverSearch(search);
        setSelectedIndex(0);
        return;
      }
    }
    setShowPopover(false);
  };

  const getLinkedPeople = (entriesList: ThreadEntry[]) => {
    const allMentions = entriesList.flatMap(e => extractMentions(e.text || ""));
    return Array.from(new Set(allMentions));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPopover && filteredPeople.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredPeople.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredPeople.length) % filteredPeople.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectPerson(filteredPeople[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowPopover(false);
      }
    } else {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleAddEntry(e);
      }
    }
  };
  
  const [deleteThreadOpen, setDeleteThreadOpen] = useState(false);
  const [deleteEntryIndex, setDeleteEntryIndex] = useState<number | null>(null);

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setIsColorPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleColorChange = async (color: string) => {
    if (!thread) return;
    setIsColorPickerOpen(false);
    try {
      const { error } = await supabase.from("threads").update({ color_accent: color }).eq("id", thread.id);
      if (error) throw error;
      setThread({ ...thread, color_accent: color });
      toast.success("Color updated");
    } catch (error: any) {
      toast.error("Failed to update color", { description: error.message });
    }
  };

  const handleArchive = async () => {
    if (!thread) return;
    try {
      const newStatus = (thread.status === "archived" || thread.status === "deleted") ? "active" : "archived";
      const { error } = await supabase.from("threads").update({ status: newStatus }).eq("id", thread.id);
      if (error) throw error;
      toast.success(newStatus === "active" ? "Thread restored" : "Thread archived");
      router.push("/think");
    } catch (error: any) {
      toast.error("Failed to update thread status", { description: error.message });
    }
  };

  const handleDelete = async () => {
    if (!thread) return;
    try {
      if (thread.status === "deleted") {
        const { error } = await supabase.from("threads").delete().eq("id", id);
        if (error) throw error;
        toast.success("Thread permanently deleted");
      } else {
        const { error } = await supabase.from("threads").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        toast.success("Moved to trash");
      }
      router.push("/think");
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    } finally {
      setDeleteThreadOpen(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim() || !thread) return;
    setSaving(true);
    
    try {
      const entry = { text: newEntry.trim(), created_at: new Date().toISOString() };
      const updatedEntries = [...(thread.entries || []), entry];
      const linkedPeople = getLinkedPeople(updatedEntries);
      
      const { error } = await supabase.from("threads").update({ 
        entries: updatedEntries,
        last_updated: new Date().toISOString(),
        stale_prompt: null, // Clear stale prompt if they revisit
        linked_people_ids: linkedPeople
      }).eq("id", thread.id);

      if (error) throw error;
      
      setThread({ ...thread, entries: updatedEntries, stale_prompt: null });
      setNewEntry("");
      toast.success("Added to thread");
    } catch (error: any) {
      logger.error("Think error:", error);
      toast.error("Failed to save thought", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-3)]" /></div>;
  }

  if (!thread) {
    return <div className="text-center py-20 text-[var(--color-text-3)]">Thread not found.</div>;
  }

  const handleDeleteEntry = async () => {
    if (!thread || deleteEntryIndex === null) return;
    try {
      const updatedEntries = thread.entries.filter((_, i) => i !== deleteEntryIndex);
      const linkedPeople = getLinkedPeople(updatedEntries);
      const { error } = await supabase.from("threads").update({ 
        entries: updatedEntries,
        linked_people_ids: linkedPeople
      }).eq("id", thread.id);
      if (error) throw error;
      setThread({ ...thread, entries: updatedEntries });
      toast.success("Entry deleted");
    } catch (err: any) {
      toast.error("Failed to delete entry", { description: err.message });
    } finally {
      setDeleteEntryIndex(null);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-32">
      <Link href="/think" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Think
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="relative pt-1" ref={colorPickerRef}>
            <button 
              type="button"
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              className="w-1.5 h-10 rounded-full shrink-0 cursor-pointer focus:outline-none"
              style={{ backgroundColor: thread.color_accent }}
              title="Change thread accent color"
            />
            {isColorPickerOpen && (
              <div className="absolute left-0 top-full pt-2 z-50">
                <div className="flex bg-[var(--color-background)] border border-[var(--color-border)] p-2 rounded-xl shadow-xl gap-2">
                  {["#FBBF24", "#F472B6", "#2DD4BF", "#A78BFA", "#60A5FA", "#F87171"].map(c => (
                    <button 
                      key={c} 
                      type="button"
                      onClick={() => handleColorChange(c)}
                      className="w-4 h-4 rounded-full border border-[var(--color-border)] hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <input 
              value={thread.title}
              onChange={(e) => setThread({ ...thread, title: e.target.value })}
              onBlur={async (e) => {
                const newTitle = e.target.value.trim();
                if (newTitle !== "") {
                  try {
                    await supabase.from("threads").update({ title: newTitle }).eq("id", thread.id);
                  } catch (err) {
                    toast.error("Failed to rename thread");
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="text-[26px] font-semibold text-[var(--color-text-1)] tracking-tight leading-snug bg-transparent border-none outline-none w-full hover:bg-[rgba(255,255,255,0.05)] focus:bg-[rgba(255,255,255,0.05)] rounded-lg px-2 -ml-2 py-1 transition-colors placeholder:text-[var(--color-text-3)]"
              placeholder="Thread Title"
            />
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
            className={cn("p-2 rounded-lg transition-colors", thread.is_pinned ? "bg-[rgba(45,212,191,0.1)] text-[#2DD4BF]" : "hover:bg-[var(--color-surface)] text-[var(--color-text-3)]")}
            title={thread.is_pinned ? "Unpin thread" : "Pin thread"}
          >
            <Pin className="w-4 h-4" />
          </button>
          <button 
            onClick={handleArchive}
            className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-3)] transition-colors"
            title={thread.status === "archived" || thread.status === "deleted" ? "Restore thread" : "Archive thread"}
          >
            {thread.status === "archived" || thread.status === "deleted" ? <RefreshCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => setDeleteThreadOpen(true)}
            className="p-2 rounded-lg hover:bg-[rgba(248,113,113,0.1)] text-[var(--color-text-3)] hover:text-[#F87171] transition-colors"
            title={thread.status === "deleted" ? "Delete permanently" : "Move to trash"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {linkedExplores.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-3">Linked Resources</h3>
          <div className="flex flex-wrap gap-3">
            {linkedExplores.map(item => (
              <Link key={item.id} href={`/explore/${item.id}`}>
                <GlassCard className="px-4 py-2 flex items-center gap-2 hover:bg-[var(--color-surface)] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                  <span className="text-sm text-[var(--color-text-1)] font-medium">{item.title}</span>
                  <span className="text-[10px] uppercase text-[var(--color-text-3)] ml-2">{item.type}</span>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {(thread.entries || []).map((entry, i) => (
            <m.div
              key={`${entry.created_at}-${i}`}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
            <GlassCard className="p-5 border-l-2 border-l-transparent hover:border-l-[#2DD4BF] transition-all group relative">
              <p className="text-[15px] text-[var(--color-text-1)] leading-relaxed whitespace-pre-wrap pr-8">{entry.text}</p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-[var(--color-text-3)]">
                  {new Date(entry.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <button 
                onClick={() => setDeleteEntryIndex(i)}
                className="absolute top-4 right-4 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-[rgba(248,113,113,0.1)] text-[var(--color-text-3)] hover:text-[#F87171]"
                title="Delete entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </GlassCard>
          </m.div>
        ))}
        </AnimatePresence>
      </div>

      {/* Fixed bottom input for thoughts */}
      <div className="fixed bottom-0 left-0 right-0 md:pl-[220px] p-4 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/90 to-transparent z-40">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleAddEntry} className="relative">
            {showPopover && filteredPeople.length > 0 && (
              <div
                className="absolute left-0 right-0 bottom-full z-50 mb-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-lg max-h-60 overflow-y-auto"
                data-testid="mentions-popover"
              >
                {filteredPeople.map((person, idx) => (
                  <button
                    key={person.id}
                    onClick={() => handleSelectPerson(person)}
                    className={cn(
                      "w-full px-4 py-2 text-left hover:bg-[rgba(255,255,255,0.05)] focus:outline-none text-sm text-[var(--color-text-1)]",
                      idx === selectedIndex && "bg-[rgba(255,255,255,0.08)]"
                    )}
                    type="button"
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            )}
            <TextareaAutosize
              ref={textareaRef}
              placeholder="Continue the thought..."
              value={newEntry}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              minRows={1}
              maxRows={10}
              className="input !pr-14 !rounded-2xl !py-4 resize-none"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <span className="text-[10px] text-[var(--color-text-3)] font-mono hidden md:inline">Cmd+Enter</span>
              <button type="submit" disabled={!newEntry.trim() || saving} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(45,212,191,0.15)] text-[#2DD4BF] hover:bg-[rgba(45,212,191,0.25)] transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
              </button>
            </div>
          </form>
        </div>
      </div>
      <ConfirmModal
        isOpen={deleteThreadOpen}
        onClose={() => setDeleteThreadOpen(false)}
        onConfirm={handleDelete}
        title={thread.status === "deleted" ? "Delete permanently?" : "Move to Trash?"}
        description={thread.status === "deleted" ? "This action cannot be undone." : "This thread will be moved to the trash and permanently deleted after 30 days."}
        confirmLabel={thread.status === "deleted" ? "Delete permanently" : "Move to Trash"}
        confirmDestructive
      />

      <ConfirmModal
        isOpen={deleteEntryIndex !== null}
        onClose={() => setDeleteEntryIndex(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Entry?"
        description="Are you sure you want to delete this thought? This action cannot be undone."
        confirmDestructive
        confirmLabel="Delete"
      />
    </div>
  );
}
