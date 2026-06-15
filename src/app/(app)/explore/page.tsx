"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Plus, Loader2, Link2, BookOpen, Quote, Lightbulb, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";
import { toast } from "sonner";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { ExploreDrawer } from "@/components/features/ExploreDrawer";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface ExploreItem {
  id: string;
  title: string;
  type: string;
  url: string | null;
  note: string;
  tags: string[];
  saved_at: string;
  revisited_at: string | null;
  status: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  link: Link2, book: BookOpen, quote: Quote, concept: Lightbulb, other: Star,
};
const TYPE_COLORS: Record<string, string> = {
  link: "var(--color-accent)", book: "#FBBF24", quote: "#F472B6", concept: "#2DD4BF", other: "#FBBF24",
};

const FILTERS = ["All Saved", "Links", "Books", "Quotes", "Concepts"];
const FILTER_MAP: Record<string, string | null> = {
  "All Saved": null, Links: "link", Books: "book", Quotes: "quote", Concepts: "concept",
};

export default function ExplorePage() {
  const supabase = createClient();
  const { userSettings, setCaptureModalOpen } = useAppStore();
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All Saved");
  const [showArchive, setShowArchive] = useState(false);
  const [editItem, setEditItem] = useState<ExploreItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ExploreItem | null>(null);

  const customTypes = userSettings?.explore_custom_types || [];
  const allFilters = [...FILTERS, ...customTypes.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1))];
  const dynamicFilterMap = { ...FILTER_MAP };
  customTypes.forEach((c: string) => dynamicFilterMap[c.charAt(0).toUpperCase() + c.slice(1)] = c);

  const fetchItems = useCallback(async () => {
    let query = supabase.from("explores").select("*").eq("status", showArchive ? "archived" : "active").order("saved_at", { ascending: false });
    const typeFilter = dynamicFilterMap[filter];
    if (typeFilter) query = query.eq("type", typeFilter);
    const { data } = await query;
    setItems(data ?? []);
    setLoading(false);
  }, [supabase, filter, showArchive]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useRealtime("explores", fetchItems);

  const timeAgo = (dt: string) => {
    const days = Math.floor((Date.now() - new Date(dt).getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const handleArchive = async (e: React.MouseEvent, item: ExploreItem) => {
    e.stopPropagation();
    try {
      const newStatus = item.status === "archived" ? "active" : "archived";
      await supabase.from("explores").update({ status: newStatus }).eq("id", item.id);
      toast.success(`Item ${newStatus === "archived" ? "archived" : "restored"}`);
      fetchItems();
    } catch (err: any) {
      toast.error("Failed to archive item");
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await supabase.from("explores").delete().eq("id", deleteItem.id);
      toast.success("Item deleted");
      fetchItems();
    } catch (err: any) {
      toast.error("Failed to delete item");
    } finally {
      setDeleteItem(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-medium text-white tracking-tight">Explore</h1>
            <button 
              onClick={() => setShowArchive(!showArchive)}
              className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showArchive ? "bg-white text-black border-white" : "border-[rgba(255,255,255,0.2)] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.05)]")}
            >
              {showArchive ? "Hide Archive" : "Show Archive"}
            </button>
          </div>
        </div>
        <button onClick={() => setCaptureModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.25)] text-[#FBBF24] text-sm font-medium hover:bg-[rgba(251,191,36,0.2)] transition-colors">
          <Plus className="w-4 h-4" /> Save item
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ContextualTip 
            id="explore_space" 
            title="Things worth keeping" 
            description="This is the Explore space. Drop interesting links, quotes, or books here. We will compile them into a digest for you every Sunday." 
          />

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {allFilters.map((f) => (
              <button
                key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-all",
              filter === f
                ? "bg-[#FBBF24] text-black border-[#FBBF24] font-semibold"
                : "border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.25)]"
            )}
          >{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" />
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="text-sm text-[rgba(255,255,255,0.3)]">Nothing saved yet. Capture &ldquo;interesting...&rdquo; or paste a URL.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((item, i) => {
            const Icon = TYPE_ICONS[item.type] ?? Star;
            const color = TYPE_COLORS[item.type] ?? "#FBBF24";
            const isUnread = !item.revisited_at;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <GlassCard
                  className={cn("p-5 hover:scale-[1.01] transition-transform relative group", isUnread && "border-[rgba(251,191,36,0.2)]")}
                >
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[rgba(11,9,20,0.8)] p-1 rounded-lg border border-[rgba(255,255,255,0.05)] backdrop-blur-md">
                    <button onClick={(e) => { e.stopPropagation(); setEditItem(item); }} className="text-xs px-2 py-1 hover:text-white text-[rgba(255,255,255,0.5)]">Edit</button>
                    <button onClick={(e) => handleArchive(e, item)} className="text-xs px-2 py-1 hover:text-white text-[rgba(255,255,255,0.5)]">{showArchive ? "Restore" : "Archive"}</button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteItem(item); }} className="text-xs px-2 py-1 hover:text-[#F87171] text-[rgba(255,255,255,0.5)]">Delete</button>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                  <div className="flex-1 min-w-0 pr-24">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white leading-snug">{item.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />}
                        <span className="text-[10px] font-bold uppercase text-[rgba(255,255,255,0.3)]">{item.type}</span>
                      </div>
                    </div>
                    {item.note && item.note !== item.title && (
                      <p className="text-xs text-[rgba(255,255,255,0.45)] mt-1 line-clamp-2">{item.note}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {item.tags?.map((tag) => (
                        <span key={tag} className="text-[10px] text-[rgba(255,255,255,0.35)] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded-full">#{tag}</span>
                      ))}
                      <span className="text-[11px] text-[rgba(255,255,255,0.25)] ml-auto">{timeAgo(item.saved_at)}</span>
                    </div>
                  </div>
                </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
        </div>
        
        <div className="space-y-6">
          <GlassCard className="p-6 border border-[#FBBF24]/20 bg-[#FBBF24]/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Star className="w-24 h-24 text-[#FBBF24]" />
            </div>
            <div className="relative z-10">
              <h3 className="text-[#FBBF24] font-semibold flex items-center gap-2 mb-2">
                <Star className="w-4 h-4" /> Sunday Digest
              </h3>
              <p className="text-sm text-[rgba(255,255,255,0.6)] mb-4">
                We're compiling your saved items. You'll receive a beautiful summary of your explorations this Sunday.
              </p>
              <div className="text-2xl font-light text-white mb-1">
                {items.filter(i => !i.revisited_at).length}
              </div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[rgba(255,255,255,0.3)]">
                Unread Items
              </p>
            </div>
          </GlassCard>
        </div>
      </div>

      <ExploreDrawer 
        item={editItem} 
        isOpen={!!editItem} 
        onClose={() => setEditItem(null)} 
        onSaved={fetchItems} 
      />
      
      <ConfirmModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Item?"
        description="Are you sure you want to delete this? It will be removed permanently."
        destructive
      />
    </div>
  );
}
