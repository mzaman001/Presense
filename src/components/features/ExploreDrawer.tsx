"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Archive, Trash2, RefreshCcw, Plus, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface ExploreDrawerProps {
  item?: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const PRESET_TYPES = ["link", "quote", "concept", "book", "movie", "article", "course", "podcast", "other"];

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
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState("");

  const [isThreadDropdownOpen, setIsThreadDropdownOpen] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);

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
          setIsCustomType(false);
        } else {
          setType("custom");
          setIsCustomType(true);
          setCustomTypeInput(item.type);
        }
      } else {
        setTitle("");
        setUrl("");
        setNote("");
        setType("link");
        setTags([]);
        setLinkedThreadId(null);
        setIsCustomType(false);
        setCustomTypeInput("");
      }

      // Fetch threads
      supabase.from("threads").select("id, title").eq("status", "active").then(({ data }) => {
        setThreads(data || []);
      });
    }
  }, [item, isOpen, supabase]);

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

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    
    let finalType = isCustomType ? customTypeInput.trim().toLowerCase() : type;
    if (!finalType) finalType = "other";

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        title,
        url: url || null,
        note,
        type: finalType,
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

      // Add to custom types if new
      if (isCustomType && finalType && !PRESET_TYPES.includes(finalType)) {
        const currentCustoms = userSettings?.explore_custom_types || [];
        if (!currentCustoms.includes(finalType)) {
          const newCustoms = [...currentCustoms, finalType];
          await supabase.from("user_settings").update({ explore_custom_types: newCustoms }).eq("user_id", user.id);
          setUserSettings({ ...userSettings, explore_custom_types: newCustoms });
        }
      }

      toast.success("Saved to Explore");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
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
    } catch (err: any) {
      toast.error("Failed to update status", { description: err.message });
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
    } catch (err: any) {
      toast.error("Failed to delete item", { description: err.message });
    } finally {
      setDeleteConfirm(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-0 right-0 h-[100dvh] w-full md:top-3 md:right-3 md:h-[calc(100dvh-24px)] md:w-[420px] md:rounded-2xl bg-[var(--color-surface)] backdrop-blur-2xl border-l md:border border-[var(--color-border)] z-50 flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] md:rounded-t-2xl">
              <h2 className="text-lg font-bold text-[var(--color-text-1)]">{item ? "Edit Explore Item" : "Save to Explore"}</h2>
              <button onClick={onClose} className="btn-icon">
                <X size={16} strokeWidth={1.5} className="shrink-0" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                <div className="relative">
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsTypeDropdownOpen(!isTypeDropdownOpen); setIsThreadDropdownOpen(false); }}
                    className="w-full flex items-center justify-between bg-[var(--surface-card)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] hover:border-[var(--accent)] transition-colors"
                  >
                    <span className="capitalize">{isCustomType ? (customTypeInput || "Custom") : type}</span>
                    <ChevronDown className="w-4 h-4 text-[var(--color-text-3)]" />
                  </button>
                  <AnimatePresence>
                    {isTypeDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="dropdown-panel absolute left-0 top-full mt-2 w-full p-1 z-50 flex flex-col gap-0.5"
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
                          className="text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--surface-hover)] text-[var(--accent)] flex items-center gap-2"
                        >
                          <Plus className="w-3 h-3" /> Add custom type
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {isCustomType && (
                  <motion.input
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    autoFocus
                    placeholder="Enter custom type and press save..."
                    value={customTypeInput}
                    onChange={(e) => setCustomTypeInput(e.target.value)}
                    className="input mt-3 !border-[var(--accent)] focus:!border-[var(--accent)]"
                  />
                )}
              </div>

              {type === 'link' && (
                <div>
                  <label className="text-label text-[var(--text-3)] block mb-2">URL</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">
                  Why are you saving this? <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="input"
                  placeholder="e.g. Fascinating idea from lecture / Riyaz recommended this book"
                />
              </div>

              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Tags</label>
                <div className="p-2 border border-[var(--color-border)] rounded-xl bg-[var(--surface-input)] focus-within:border-[var(--accent)] transition-colors flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span key={t} className="tag-pill !bg-[var(--accent-dim)] !text-[var(--accent)] !border-[var(--accent-border)]">
                      {t}
                      <button type="button" onClick={() => handleRemoveTag(t)} className="remove">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Add tag and press Enter..."
                    className="flex-1 min-w-[140px] bg-transparent px-2 py-1 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Link to Think Thread (Optional)</label>
                <div className="relative">
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsThreadDropdownOpen(!isThreadDropdownOpen); setIsTypeDropdownOpen(false); }}
                    className="w-full flex items-center justify-between bg-[var(--surface-card)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] hover:border-[var(--accent)] transition-colors"
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
                        className="dropdown-panel absolute left-0 top-full mt-2 w-full p-1 z-50 flex flex-col gap-0.5 max-h-48 overflow-y-auto no-scrollbar"
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
                disabled={saving || !title.trim() || !note.trim()}
                className="flex-1 btn-primary py-3 w-full disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin shrink-0" /> : (item ? "Save Changes" : "Save")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

