"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Search, Plus, Loader2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { LocationAddPanel } from "@/components/features/LocationAddPanel";

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
  const [editingItem, setEditingItem] = useState<LocationItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-col gap-6">

      {/* Search bar — primary interaction */}
      <div className="relative">
        <Search size={13} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search for anything you've placed somewhere..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[rgba(255,255,255,0.06)] border border-[var(--color-border)] rounded-xl pl-11 pr-4 py-3 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[rgba(74,222,128,0.5)] transition-colors"
        />
      </div>

      {/* Not found state */}
      {noResults && (
        <GlassCard className="p-5 border-[rgba(74,222,128,0.2)]">
          <p className="text-sm text-[var(--color-text-3)] mb-3">
            &ldquo;<span className="text-[var(--color-text-1)]">{search}</span>&rdquo; not found — log it now?
          </p>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg bg-[#4ADE80] text-[var(--color-background)] text-sm font-semibold">
            Log "{search}"
          </button>
        </GlassCard>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-[rgba(255,255,255,0.35)]">{items.length} item{items.length !== 1 ? "s" : ""} logged</span>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.25)] text-[#4ADE80] text-card-title hover:bg-[rgba(74,222,128,0.2)] transition-colors">
            <Plus className="w-4 h-4" /> Log item
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-3)]" />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const days = daysAgo(item.updated_at);
            const isStale = days >= 30 && days < 90;
            const isVeryStale = days >= 90;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <GlassCard 
                  onClick={() => setEditingItem(item)}
                  className={cn("px-4 py-3 relative group cursor-pointer hover:border-[rgba(74,222,128,0.25)] transition-colors",
                  isStale && "border-[rgba(251,191,36,0.25)]",
                  isVeryStale && "opacity-50"
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl shrink-0">{getEmoji(item.item_name)}</span>
                    <div className="flex-1 min-w-0 pr-20">
                      <p className={cn("text-sm font-semibold text-[var(--color-text-1)]", isVeryStale && "line-through opacity-60")}>{item.item_name}</p>
                      <p className="text-xs text-[var(--color-text-3)] truncate">{item.location_text}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {isVeryStale ? (
                        <span className="text-[10px] text-[var(--color-text-3)] flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Probably moved?</span>
                      ) : isStale ? (
                        <button onClick={(e) => { e.stopPropagation(); markStillHere(item.id); }} className="text-[10px] text-[#FBBF24] flex items-center gap-1 hover:text-[var(--color-text-1)] transition-colors border border-[rgba(251,191,36,0.3)] px-2 py-0.5 rounded-full z-10 relative">
                          Stale · Still here
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--color-text-3)] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {days === 0 ? "Today" : `${days}d ago`}
                        </span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
      <LocationAddPanel
        isOpen={showAdd || !!editingItem}
        onClose={() => {
          setShowAdd(false);
          setEditingItem(null);
        }}
        onLocationAdded={fetchItems}
        itemToEdit={editingItem}
        initialName={search}
      />
    </>
  );
}

