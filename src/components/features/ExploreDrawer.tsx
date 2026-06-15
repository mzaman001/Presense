"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Link2, BookOpen, Quote, Lightbulb, Star, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";

interface ExploreDrawerProps {
  item: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ExploreDrawer({ item, isOpen, onClose, onSaved }: ExploreDrawerProps) {
  const supabase = createClient();
  const { userSettings } = useAppStore();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState("link");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && isOpen) {
      setTitle(item.title || "");
      setUrl(item.url || "");
      setNote(item.note || "");
      setType(item.type || "link");
    }
  }, [item, isOpen]);

  const customTypes = userSettings?.explore_custom_types || [];
  const baseTypes = ["link", "book", "quote", "concept"];
  const allTypes = [...baseTypes, ...customTypes, "other"];

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("explores").update({
        title, url, note, type
      }).eq("id", item.id);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && item && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[rgba(11,9,20,0.95)] backdrop-blur-3xl border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-semibold text-[var(--color-text-1)]">Edit Explore Item</h2>
              <button onClick={onClose} className="p-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] rounded-lg hover:bg-[var(--color-surface)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-3)] mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-border)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-3)] mb-2">URL (Optional)</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-border)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-3)] mb-2">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-border)] transition-colors appearance-none"
                >
                  {allTypes.map((t) => (
                    <option key={t} value={t} className="bg-[#111]">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-3)] mb-2">Note (Optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={6}
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-border)] transition-colors resize-none"
                  placeholder="Why is this interesting?"
                />
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-border)]">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-[var(--color-text-1)] text-[var(--color-background)] font-semibold rounded-xl py-3 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
