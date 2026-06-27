"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Plus, Loader2, Link2, BookOpen, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";
import { toast } from "sonner";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { ExploreDrawer } from "@/components/features/ExploreDrawer";

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
  link: Link2, book: BookOpen, note: Lightbulb,
};
const TYPE_COLORS: Record<string, string> = {
  link: "var(--color-accent)", book: "var(--accent)", note: "#2DD4BF",
};

const FILTERS = ["All Saved", "Links", "Notes", "Books"];
const FILTER_MAP: Record<string, string | null> = {
  "All Saved": null, Links: "link", Notes: "note", Books: "book",
};

export default function ExplorePage() {
  const supabase = createClient();
  const { userSettings, setCaptureModalOpen } = useAppStore();
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All Saved");
  const [showArchive, setShowArchive] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [editItem, setEditItem] = useState<ExploreItem | null>(null);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    let query = supabase.from("explores").select("*").order("saved_at", { ascending: false });
    
    if (showTrash) query = query.eq("status", "deleted");
    else if (showArchive) query = query.eq("status", "archived");
    else query = query.eq("status", "active");

    const typeFilter = FILTER_MAP[filter];
    if (typeFilter && !showTrash && !showArchive) {
      if (typeFilter === "note") {
        query = query.in("type", ["note", "quote", "concept"]);
      } else {
        query = query.eq("type", typeFilter);
      }
    }
    const { data } = await query;
    setItems(data ?? []);
    setLoading(false);
  }, [supabase, filter, showArchive, showTrash]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-medium text-[var(--color-text-1)] tracking-tight">Explore</h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setShowArchive(false); setShowTrash(false); }}
                className={cn("text-xs px-3 py-1 rounded-full border transition-colors", !showArchive && !showTrash ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
              >
                Active
              </button>
              <button 
                onClick={() => { setShowArchive(true); setShowTrash(false); }}
                className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showArchive ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
              >
                Archive
              </button>
              <button 
                onClick={() => { setShowTrash(true); setShowArchive(false); }}
                className={cn("text-xs px-3 py-1 rounded-full border transition-colors", showTrash ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]")}
              >
                Trash
              </button>
            </div>
          </div>
        </div>
        <button onClick={() => setIsAddDrawerOpen(true)} className="btn-secondary !text-[var(--accent)] !border-[var(--accent-border)] !bg-[var(--accent-dim)] hover:!bg-[var(--accent-dim-hover)]">
          <Plus className="w-4 h-4" /> Save item
        </button>
      </div>

      <div className="flex flex-col gap-6">
        <div className="space-y-6">
          <ContextualTip 
            id="explore_space" 
            title="Things worth keeping" 
            description="This is the Explore space. Drop interesting links, quotes, or books here to revisit them later." 
          />

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-all",
              filter === f
                ? "bg-[var(--accent)] text-[var(--color-background)] border-[var(--accent)] font-semibold"
                : "border-[var(--color-border)] text-[var(--color-text-3)] hover:border-[var(--color-border)]"
            )}
          >{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-3)]" />
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="text-sm text-[var(--color-text-3)]">Nothing saved yet. Capture &ldquo;interesting...&rdquo; or paste a URL.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((item, i) => {
            const mappedType = (item.type === "quote" || item.type === "concept") ? "note" : (["link", "note", "book"].includes(item.type) ? item.type : "note");
            const Icon = TYPE_ICONS[mappedType] ?? Lightbulb;
            const color = TYPE_COLORS[mappedType] ?? "#2DD4BF";
            const isUnread = !item.revisited_at;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <GlassCard
                  onClick={() => setEditItem(item)}
                  className={cn("p-5 hover:scale-[1.01] transition-transform relative group cursor-pointer hover:border-[var(--color-accent)]/30", isUnread && "border-[var(--accent-dim-hover)]")}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                  <div className="flex-1 min-w-0 pr-24">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text-1)] leading-snug">{item.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                        <span className="text-[10px] font-bold uppercase text-[var(--color-text-3)]">{mappedType}</span>
                      </div>
                    </div>
                    {item.note && item.note !== item.title && (
                      <p className="text-xs text-[rgba(255,255,255,0.45)] mt-1 line-clamp-2">{item.note}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {item.tags?.map((tag) => (
                        <span key={tag} className="text-[10px] text-[rgba(255,255,255,0.35)] bg-[var(--color-surface)] px-2 py-0.5 rounded-full">#{tag}</span>
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
      </div>

      <ExploreDrawer 
        item={editItem} 
        isOpen={!!editItem || isAddDrawerOpen} 
        onClose={() => { setEditItem(null); setIsAddDrawerOpen(false); }} 
        onSaved={fetchItems} 
      />
    </div>
  );
}

