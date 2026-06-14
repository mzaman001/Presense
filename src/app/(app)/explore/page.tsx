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
import Link from "next/link";

interface ExploreItem {
  id: string;
  title: string;
  type: string;
  url: string | null;
  note: string;
  tags: string[];
  saved_at: string;
  revisited_at: string | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  link: Link2, book: BookOpen, quote: Quote, concept: Lightbulb, other: Star,
};
const TYPE_COLORS: Record<string, string> = {
  link: "#8B7CF8", book: "#FBBF24", quote: "#F472B6", concept: "#2DD4BF", other: "#FBBF24",
};

const FILTERS = ["All Saved", "Links", "Books", "Quotes", "Concepts"];
const FILTER_MAP: Record<string, string | null> = {
  "All Saved": null, Links: "link", Books: "book", Quotes: "quote", Concepts: "concept",
};

export default function ExplorePage() {
  const supabase = createClient();
  const setCaptureModalOpen = useAppStore((state) => state.setCaptureModalOpen);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All Saved");
  const [showArchive, setShowArchive] = useState(false);

  const fetchItems = useCallback(async () => {
    let query = supabase.from("explores").select("*").eq("status", showArchive ? "archived" : "active").order("saved_at", { ascending: false });
    const typeFilter = FILTER_MAP[filter];
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

      <ContextualTip 
        id="explore_space" 
        title="Things worth keeping" 
        description="This is the Explore space. Drop interesting links, quotes, or books here. We will compile them into a digest for you every Sunday." 
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item, i) => {
            const Icon = TYPE_ICONS[item.type] ?? Star;
            const color = TYPE_COLORS[item.type] ?? "#FBBF24";
            const isUnread = !item.revisited_at;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/explore/${item.id}`}>
                  <GlassCard
                    className={cn("p-5 hover:scale-[1.01] transition-transform cursor-pointer h-full", isUnread && "border-[rgba(251,191,36,0.2)]")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                    <div className="flex-1 min-w-0">
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
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
