"use client";
import { PageHeader } from "@/components/ui/PageHeader";


import React, { useEffect, useState, useCallback } from "react";
import { m, useMotionValue, useTransform, animate } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Plus, Loader2, Link2, BookOpen, Lightbulb, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { ExploreDrawer } from "@/components/features/ExploreDrawer";
import { LenisProvider } from "@/components/layout/LenisProvider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

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

const ExploreItemCard = ({ 
  item, 
  setEditItem, 
  deleteExploreItem, 
  timeAgo 
}: {
  item: ExploreItem;
  setEditItem: (item: ExploreItem) => void;
  deleteExploreItem: (item: ExploreItem) => void;
  timeAgo: (dt: string) => string;
}) => {
  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [0, -80], [0, 1]);
  const deleteScale = useTransform(dragX, [0, -80], [0.7, 1]);

  const handleDragEnd = async (_: any, info: any) => {
    if (info.offset.x < -80) {
      animate(dragX, -300, { duration: 0.2 });
      deleteExploreItem(item);
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  const mappedType = (item.type === "quote" || item.type === "concept") ? "note" : (["link", "note", "book"].includes(item.type) ? item.type : "note");
  const Icon = TYPE_ICONS[mappedType] ?? Lightbulb;
  const color = TYPE_COLORS[mappedType] ?? "#2DD4BF";
  const isUnread = !item.revisited_at;

  return (
    <m.div
      layout
      layoutId={item.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="explore-item-wrapper group relative rounded-2xl overflow-hidden"
    >
      {/* Swipe-to-delete reveal layer */}
      <m.div
        className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
          opacity: deleteOpacity,
        }}
      >
        <m.div style={{ scale: deleteScale }}>
          <Trash2 className="w-5 h-5 text-red-400" />
        </m.div>
      </m.div>

      {/* Draggable card */}
      <m.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="relative"
      >
        <GlassCard
          onClick={() => setEditItem(item)}
          className={cn("p-5 hover:scale-[1.01] transition-transform relative group cursor-pointer hover:border-[var(--color-accent)]/30 !rounded-2xl", isUnread && "border-[var(--accent-dim-hover)]")}
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
                  <span className="text-caption font-bold uppercase text-[var(--color-text-3)]">{mappedType}</span>
                </div>
              </div>
              {item.note && item.note !== item.title && (
                <p className="text-xs text-[rgba(255,255,255,0.45)] mt-1 line-clamp-2">{item.note}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {item.tags?.map((tag) => (
                  <span key={tag} className="text-caption text-[rgba(255,255,255,0.35)] bg-[var(--color-surface)] px-2 py-0.5 rounded-full">#{tag}</span>
                ))}
                <span className="text-meta text-[rgba(255,255,255,0.25)] ml-auto">{timeAgo(item.saved_at)}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </m.div>
    </m.div>
  );
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

  const deleteExploreItem = async (item: ExploreItem) => {
    setItems(prev => prev.filter(t => t.id !== item.id));

    try {
      const { error } = await supabase.from("explores").update({
        status: "deleted",
        deleted_at: new Date().toISOString()
      }).eq("id", item.id);

      if (error) throw error;
      toast.success("Moved to trash", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await supabase.from("explores").update({ status: "active", deleted_at: null }).eq("id", item.id);
              setItems(prev => [item, ...prev]);
            } catch {
              toast.error("Failed to restore");
              fetchItems();
            }
          }
        }
      });
    } catch {
      toast.error("Failed to delete");
      fetchItems();
    }
  };

  return (
    <LenisProvider>
      <div className="space-y-6">
      <PageHeader
        title="Explore"
        actions={
          <Button variant="secondary" onClick={() => setIsAddDrawerOpen(true)} className="!text-[var(--accent)] !border-[var(--accent-border)] !bg-[var(--accent-dim)] hover:!bg-[var(--accent-dim-hover)]">
            <Plus className="w-4 h-4" /> Save item
          </Button>
        }
      >
        <Tabs value={showTrash ? "trash" : showArchive ? "archive" : "active"} onValueChange={(v) => {
          setShowArchive(v === "archive");
          setShowTrash(v === "trash");
        }}>
          <TabsList variant="line" className="border-[var(--color-border)]">
            <TabsTrigger value="active" className="data-active:text-[var(--accent)] data-active:after:bg-[var(--accent)]">Active</TabsTrigger>
            <TabsTrigger value="archive" className="data-active:text-[var(--accent)] data-active:after:bg-[var(--accent)]">Archive</TabsTrigger>
            <TabsTrigger value="trash" className="data-active:text-[var(--accent)] data-active:after:bg-[var(--accent)]">Trash</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

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
            <div className="py-6">
              <PageSkeleton count={4} type="card" />
            </div>
          ) : items.length === 0 ? (
            <GlassCard className="p-12 text-center flex flex-col items-center justify-center border-dashed border-[rgba(255,255,255,0.08)]">
              <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-4">
                <Link2 className="w-6 h-6 text-[var(--color-text-3)]" />
              </div>
              <h3 className="text-[var(--color-text-1)] font-medium mb-2">Nothing saved yet</h3>
              <p className="text-sm text-[var(--color-text-3)] max-w-sm mb-6">Capture &ldquo;interesting...&rdquo; or paste a URL to save articles, tweets, and links.</p>
              <Button variant="primary" 
                onClick={() => useAppStore.getState().setCaptureModalOpen(true)}
                className="gap-2"
              >
                <Plus size={16} /> Save Link
              </Button>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {items.map((item) => (
                <ExploreItemCard
                  key={item.id}
                  item={item}
                  setEditItem={setEditItem}
                  deleteExploreItem={deleteExploreItem}
                  timeAgo={timeAgo}
                />
              ))}
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
    </LenisProvider>
  );
}

