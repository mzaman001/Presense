"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Search, Plus, Loader2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface LocationItem {
  id: string;
  item_name: string;
  location_text: string;
  updated_at: string;
}

const EMOJI_MAP: Record<string, string> = {
  keys: "🔑", key: "🔑", wallet: "👛", phone: "📱", charger: "🔌",
  laptop: "💻", headphones: "🎧", notebook: "📒", book: "📖", glasses: "👓",
  watch: "⌚", bag: "🎒", card: "💳", id: "🪪", passport: "📕",
  cable: "🔌", pen: "🖊️", bottle: "🍶", umbrella: "☂️", shoes: "👟",
};

function getEmoji(name: string): string {
  const lower = name.toLowerCase();
  return Object.entries(EMOJI_MAP).find(([k]) => lower.includes(k))?.[1] ?? "📦";
}

function daysAgo(dt: string): number {
  return Math.floor((Date.now() - new Date(dt).getTime()) / 86400000);
}

export default function LocationsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const startEdit = (e: React.MouseEvent, item: LocationItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.item_name);
    setEditLoc(item.location_text);
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editLoc.trim() || !editingId) return;
    try {
      const { error } = await supabase.from("locations").update({
        item_name: editName.trim(),
        location_text: editLoc.trim(),
        updated_at: new Date().toISOString()
      }).eq("id", editingId);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === editingId ? { ...i, item_name: editName.trim(), location_text: editLoc.trim(), updated_at: new Date().toISOString() } : i));
      toast.success("Location updated");
      setEditingId(null);
    } catch (err: any) {
      toast.error("Failed to update location", { description: err.message });
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("locations").delete().eq("id", deleteId);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== deleteId));
      toast.success("Location deleted");
    } catch (err: any) {
      toast.error("Failed to delete location", { description: err.message });
    } finally {
      setDeleteId(null);
    }
  };

  const fetchItems = useCallback(async () => {
    let query = supabase.from("locations").select("*").order("updated_at", { ascending: false });
    if (search.trim()) {
      query = query.or(`item_name.ilike.%${search}%,location_text.ilike.%${search}%`);
    }
    const { data } = await query;
    setItems(data ?? []);
    setLoading(false);
  }, [supabase, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useRealtime("locations", fetchItems);

  const saveLocation = async () => {
    if (!newName.trim() || !newLoc.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase.from("locations").insert({
          user_id: user.id,
          item_name: newName.trim(),
          location_text: newLoc.trim(),
        }).select().single();

        if (error) {
          toast.error("Failed to save location", { description: error.message });
        } else if (data) {
          toast.success("Location logged");
          setItems((prev) => [data, ...prev]);
          setNewName("");
          setNewLoc("");
          setShowAdd(false);
        }
      }
    } catch (err: any) {
      toast.error("Unexpected error", { description: err.message || "Could not save location" });
    } finally {
      setSaving(false);
    }
  };

  const markStillHere = async (id: string) => {
    try {
      const { error } = await supabase.from("locations").update({ updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, updated_at: new Date().toISOString() } : i));
      toast.success("Location updated");
    } catch (err: any) {
      toast.error("Failed to update location", { description: err.message });
    }
  };

  const noResults = !loading && items.length === 0 && search.trim();

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.25)] text-[#4ADE80] text-sm font-medium hover:bg-[rgba(74,222,128,0.2)] transition-colors">
          <Plus className="w-4 h-4" /> Log Location
        </button>
      </div>

      {/* Search bar — primary interaction */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(255,255,255,0.35)]" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search for anything you've placed somewhere..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none focus:border-[rgba(74,222,128,0.5)] transition-colors"
        />
      </div>

      {/* Not found state */}
      {noResults && (
        <GlassCard className="p-5 border-[rgba(74,222,128,0.2)]">
          <p className="text-sm text-[rgba(255,255,255,0.5)] mb-3">
            &ldquo;<span className="text-white">{search}</span>&rdquo; not found — log it now?
          </p>
          <div className="flex gap-2">
            <input
              value={newName || search}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Item name"
              className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none"
            />
            <input
              value={newLoc}
              onChange={(e) => setNewLoc(e.target.value)}
              placeholder="Where is it?"
              className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none"
            />
            <button onClick={saveLocation} disabled={saving} className="px-4 py-2 rounded-lg bg-[#4ADE80] text-black text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log"}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Add inline form */}
      <AnimatePresence>
        {showAdd && !noResults && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GlassCard className="p-4 border-[rgba(74,222,128,0.25)]">
              <div className="flex gap-2 flex-wrap">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Item name (e.g. Keys, Charger)"
                  className="flex-1 min-w-[140px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none"
                />
                <input
                  value={newLoc}
                  onChange={(e) => setNewLoc(e.target.value)}
                  placeholder="Where is it?"
                  onKeyDown={(e) => e.key === "Enter" && saveLocation()}
                  className="flex-1 min-w-[140px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none"
                />
                <button onClick={saveLocation} disabled={saving || !newName.trim() || !newLoc.trim()} className="px-4 py-2 rounded-lg bg-[#4ADE80] text-black text-sm font-semibold disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </button>
                <button onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-lg text-[rgba(255,255,255,0.4)] hover:text-white text-sm transition-colors">Cancel</button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <span className="text-xs text-[rgba(255,255,255,0.35)]">{items.length} item{items.length !== 1 ? "s" : ""} logged</span>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm text-[#4ADE80] hover:text-white transition-colors">
            <Plus className="w-4 h-4" /> Log item
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const days = daysAgo(item.updated_at);
            const isStale = days >= 30 && days < 90;
            const isVeryStale = days >= 90;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <GlassCard className={cn("px-4 py-3 relative group",
                  isStale && "border-[rgba(251,191,36,0.25)]",
                  isVeryStale && "opacity-50"
                )}>
                  {editingId === item.id ? (
                    <div className="flex gap-2 flex-wrap items-center">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 min-w-[100px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 text-sm text-white"
                      />
                      <input
                        value={editLoc}
                        onChange={(e) => setEditLoc(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        className="flex-1 min-w-[100px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 text-sm text-white"
                      />
                      <button onClick={saveEdit} className="px-3 py-1.5 rounded-lg bg-[#4ADE80] text-black text-xs font-semibold">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-[rgba(255,255,255,0.4)] hover:text-white text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-2xl shrink-0">{getEmoji(item.item_name)}</span>
                      <div className="flex-1 min-w-0 pr-20">
                        <p className={cn("text-sm font-semibold text-white", isVeryStale && "line-through opacity-60")}>{item.item_name}</p>
                        <p className="text-xs text-[rgba(255,255,255,0.5)] truncate">{item.location_text}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-1 group-hover:opacity-0 transition-opacity">
                        {isVeryStale ? (
                          <span className="text-[10px] text-[rgba(255,255,255,0.3)] flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Probably moved?</span>
                        ) : isStale ? (
                          <button onClick={() => markStillHere(item.id)} className="text-[10px] text-[#FBBF24] flex items-center gap-1 hover:text-white transition-colors border border-[rgba(251,191,36,0.3)] px-2 py-0.5 rounded-full">
                            Stale · Still here
                          </button>
                        ) : (
                          <span className="text-[11px] text-[rgba(255,255,255,0.3)] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {days === 0 ? "Today" : `${days}d ago`}
                          </span>
                        )}
                      </div>
                      <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[rgba(11,9,20,0.8)] p-1 rounded-lg border border-[rgba(255,255,255,0.05)] backdrop-blur-md z-10">
                        <button onClick={(e) => startEdit(e, item)} className="text-xs px-2 py-1 hover:text-white text-[rgba(255,255,255,0.5)]">Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }} className="text-xs px-2 py-1 hover:text-[#F87171] text-[rgba(255,255,255,0.5)]">Delete</button>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
    <ConfirmModal
      isOpen={!!deleteId}
      onClose={() => setDeleteId(null)}
      onConfirm={confirmDelete}
      title="Delete Location"
      description="Are you sure you want to delete this location? This cannot be undone."
      confirmLabel="Delete"
      confirmDestructive
    />
    </>
  );
}
