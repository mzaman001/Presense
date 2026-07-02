"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { X, Loader2, Archive, Trash2, RefreshCcw, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Sheet } from "@/components/ui/Sheet";
import { m, AnimatePresence } from "framer-motion";

interface ExploreDrawerProps {
  item?: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const PRESET_TYPES = ["link", "note", "book"];

export function ExploreDrawer({ item, isOpen, onClose, onSaved }: ExploreDrawerProps) {
  const supabase = createClient();
  const { userSettings, setUserSettings } = useAppStore();
  
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState("link");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [linkedThreadId, setLinkedThreadId] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Dropdown states
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const [isThreadDropdownOpen, setIsThreadDropdownOpen] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);

  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const threadDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setTitle(item.title || "");
        setUrl(item.url || "");
        setNote(item.note || "");
        setTags(item.tags || []);
        setLinkedThreadId(item.linked_thread_id || null);
        
        if (PRESET_TYPES.includes(item.type)) {
          setType(item.type);
        } else if (item.type === "quote" || item.type === "concept") {
          setType("note");
        } else {
          setType("note");
        }
      } else {
        setTitle("");
        setUrl("");
        setNote("");
        setType("link");
        setTags([]);
        setLinkedThreadId(null);
      }

      // Fetch threads
      supabase.from("threads").select("id, title").eq("status", "active").then(({ data }: { data: any }) => {
        setThreads(data || []);
      });
    }
  }, [item, isOpen, supabase]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setIsTypeDropdownOpen(false);
      }
      if (threadDropdownRef.current && !threadDropdownRef.current.contains(target)) {
        setIsThreadDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        title,
        url: url || null,
        note,
        type: type,
        tags,
        linked_thread_id: linkedThreadId || null,
      };

      if (item) {
        const { error } = await supabase.from("explores").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("explores").insert(payload);
        if (error) throw error;
      }

      toast.success("Saved to Explore");
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error("Failed to save", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const newStatus = (item.status === "archived" || item.status === "deleted") ? "active" : "archived";
      const { error } = await supabase.from("explores").update({ status: newStatus }).eq("id", item.id);
      if (error) throw error;
      toast.success(`Item ${newStatus === "active" ? "restored" : "archived"}`);
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error("Failed to update status", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!item) return;
    try {
      if (item.status === "deleted") {
        // Hard delete
        const { error } = await supabase.from("explores").delete().eq("id", item.id);
        if (error) throw error;
        toast.success("Item permanently deleted");
      } else {
        // Move to trash (deleted status)
        const { error } = await supabase.from("explores").update({ 
          status: "deleted",
          deleted_at: new Date().toISOString()
        }).eq("id", item.id);
        if (error) throw error;
        toast.success("Moved to trash");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error("Failed to delete item", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setDeleteConfirm(false);
    }
  };

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title={item ? "Edit Explore Item" : "Save to Explore"}
      >
            <div className="space-y-6">
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[var(--surface-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>

              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Type <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-[var(--surface-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. link, note, book"
                  list="preset-explore-types"
                />
                <datalist id="preset-explore-types">
                  {PRESET_TYPES.map(preset => <option key={preset} value={preset} />)}
                </datalist>
              </div>

              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                  className="input"
                  placeholder="e.g. https://example.com"
                />
              </div>

              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">
                  Why are you saving this? <span className="text-red-400">*</span>
                </label>
                <TextareaAutosize
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  minRows={3}
                  className="input resize-none"
                  placeholder="e.g. Fascinating idea from lecture / Riyaz recommended this book"
                />
              </div>



              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Link to Think Thread (Optional)</label>
                <div className="relative" ref={threadDropdownRef}>
                  <button 
                    type="button"
                    onClick={() => { setIsThreadDropdownOpen(!isThreadDropdownOpen); setIsTypeDropdownOpen(false); }}
                    className="w-full flex items-center justify-between bg-[var(--surface-card)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] hover:border-[var(--accent)] transition-colors"
                  >
                    <span className="truncate pr-4">
                      {linkedThreadId ? threads.find(t => t.id === linkedThreadId)?.title || "Unknown Thread" : "-- No Thread Linked --"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-[var(--color-text-3)] shrink-0" />
                  </button>
                  <AnimatePresence>
                    {isThreadDropdownOpen && (
                      <m.div 
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="dropdown-panel absolute left-0 top-full mt-2 w-full p-1 z-50 flex flex-col gap-0.5 max-h-48 overflow-y-auto no-scrollbar"
                      >
                        <button 
                          type="button"
                          onClick={() => { setLinkedThreadId(null); setIsThreadDropdownOpen(false); }}
                          className="text-left px-3 py-2 text-sm rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--color-text-3)]"
                        >
                          -- No Thread Linked --
                        </button>
                        {threads.map(t => (
                          <button 
                            key={t.id} type="button"
                            onClick={() => { setLinkedThreadId(t.id); setIsThreadDropdownOpen(false); }}
                            className="text-left px-3 py-2 text-sm rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--color-text-1)] truncate"
                          >
                            {t.title}
                          </button>
                        ))}
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] flex gap-3 md:rounded-b-2xl">
              {item && (
                <>
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="btn-danger px-4 flex items-center justify-center"
                    title={item.status === "deleted" ? "Delete permanently" : "Move to trash"}
                  >
                    <Trash2 size={14} strokeWidth={1.5} className="shrink-0" />
                  </button>
                  <button
                    onClick={handleArchiveToggle}
                    disabled={saving}
                    className="btn-secondary px-4 flex items-center justify-center disabled:opacity-50"
                    title={item.status === "archived" || item.status === "deleted" ? "Restore" : "Archive"}
                  >
                    {item.status === "archived" || item.status === "deleted" ? <RefreshCcw size={14} strokeWidth={1.5} className="shrink-0" /> : <Archive size={14} strokeWidth={1.5} className="shrink-0" />}
                  </button>
                </>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !note?.trim()}
                className="flex-1 btn-primary py-3 w-full disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin shrink-0" /> : (item ? "Save Changes" : "Save")}
              </button>
            </div>
      </Sheet>
      {item && (
        <ConfirmModal
          isOpen={deleteConfirm}
          onClose={() => setDeleteConfirm(false)}
          onConfirm={confirmDelete}
          title={item.status === "deleted" ? "Delete permanently?" : "Move to Trash?"}
          description={item.status === "deleted" ? "This action cannot be undone." : "This item will be moved to the trash and permanently deleted after 30 days."}
          confirmLabel={item.status === "deleted" ? "Delete permanently" : "Move to Trash"}
          confirmDestructive
        />
      )}
    </>
  );
}

