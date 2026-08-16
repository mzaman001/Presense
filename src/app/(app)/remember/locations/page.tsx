"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Search, Plus, Loader2, Clock, AlertCircle, MapPin, Trash2, Key, Wallet, Smartphone, Plug, Laptop, Headphones, Notebook, Book, Glasses, Watch, Briefcase, CreditCard, IdCard, Plane, PenTool, Baby, Umbrella, Footprints, Package } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { LocationAddPanel } from "@/components/features/LocationAddPanel";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";

interface LocationItem {
  id: string;
  item_name: string;
  location_text: string;
  updated_at: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  keys: Key, key: Key, wallet: Wallet, phone: Smartphone, charger: Plug,
  laptop: Laptop, headphones: Headphones, notebook: Notebook, book: Book, glasses: Glasses,
  watch: Watch, bag: Briefcase, card: CreditCard, id: IdCard, passport: Plane,
  cable: Plug, pen: PenTool, bottle: Baby, umbrella: Umbrella, shoes: Footprints,
};

function getIcon(name: string): React.ElementType {
  const lower = name.toLowerCase();
  return Object.entries(ICON_MAP).find(([k]) => lower.includes(k))?.[1] ?? Package;
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
    // INFRA-18: explicit user_id filter for planner index usage.
    const { data: userSession } = await supabase.auth.getUser();
    if (!userSession?.user) return;
    // BUG-08: trashed locations must not render in the list on any client.
    let query = supabase
      .from("locations")
      .select("*")
      .eq("user_id", userSession.user.id)
      .neq("status", "deleted")
      .order("updated_at", { ascending: false });
    if (search.trim()) {
      query = query.or(`item_name.ilike.%${search}%,location_text.ilike.%${search}%`);
    }
    const { data } = await query;
    setItems((data as LocationItem[]) ?? []);
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
    } catch (err: unknown) {
      toast.error("Failed to update location", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const noResults = !loading && items.length === 0 && search.trim();

  return (
    <>
    <div className="flex flex-col gap-6">

      {/* Search bar â€” primary interaction */}
      <div className="relative">
        <UiIcon size={13} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)]" icon={Search} />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search for anything you've placed somewhere..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[var(--surface-input)] border border-[var(--border-input)] rounded-xl pl-11 pr-4 py-3 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[var(--border-input-focus)] transition-colors"
        />
      </div>

      {/* Not found state */}
      {noResults && (
        <GlassCard className="p-5 border-[var(--accent-border)]">
          <p className="text-sm text-[var(--color-text-3)] mb-3">
            &ldquo;<span className="text-[var(--color-text-1)]">{search}</span>&rdquo; not found â€” log it now?
          </p>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--text-on-accent)] text-sm font-semibold hover:bg-[var(--accent-hot)] transition-colors">
            Log "{search}"
          </button>
        </GlassCard>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-1)] inline">All Locations</h2>
          <span className="text-xs text-[var(--color-text-3)] font-normal ml-2">{items.length} item{items.length !== 1 ? "s" : ""} logged</span>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--accent)] text-card-title hover:bg-[var(--accent-dim-hover)] transition-colors">
            <UiIcon className="w-4 h-4" icon={Plus} /> Log item
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-6">
          <PageSkeleton count={4} type="task" />
        </div>
      ) : items.length === 0 && !search.trim() ? (
        <EmptyState
          icon={MapPin}
          title="No locations here"
          description="Log an item to remember where you put it."
          pointer={
            // BUG-08 / CONF-10 (Option C): thin pointer to the global trash
            <a
              href="/trash?filter=location"
              className="underline underline-offset-2 hover:text-[var(--color-accent)]"
            >
              <UiIcon className="mr-1 inline h-3 w-3 align-[-2px]" icon={Trash2} />
              Check the trash for deleted locations
            </a>
          }
          action={
            <Button variant="primary" onClick={() => setShowAdd(true)} className="gap-2 mx-auto">
              <UiIcon size={16} icon={Plus} /> Log Item
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const days = daysAgo(item.updated_at);
            const isStale = days >= 30 && days < 90;
            const isVeryStale = days >= 90;
            return (
              <m.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <GlassCard 
                  onClick={() => setEditingItem(item)}
                  className={cn("px-4 py-3 relative group cursor-pointer hover:border-[var(--accent-border)] transition-all duration-200 ease-out hover:scale-[1.01] hover:-translate-y-px",
                  isStale && "border-[rgba(251,191,36,0.25)]",
                  isVeryStale && "opacity-50"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center shrink-0">
                      {React.createElement(getIcon(item.item_name), { className: "w-4 h-4 text-[var(--color-text-2)]" })}
                    </div>
                    <div className="flex-1 min-w-0 pr-20">
                      <p className={cn("text-sm font-semibold text-[var(--color-text-1)]", isVeryStale && "line-through opacity-60")}>{item.item_name}</p>
                      <p className="text-xs text-[var(--color-text-3)] truncate">{item.location_text}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {isVeryStale ? (
                        <span className="text-caption text-[var(--color-text-3)] flex items-center gap-1"><UiIcon className="w-3 h-3" icon={AlertCircle} /> Probably moved?</span>
                      ) : isStale ? (
                        <button onClick={(e) => { e.stopPropagation(); markStillHere(item.id); }} className="text-caption text-[#FBBF24] flex items-center gap-1 hover:text-[var(--color-text-1)] transition-colors border border-[rgba(251,191,36,0.3)] px-2 py-0.5 rounded-full z-10 relative">
                          Stale Â· Still here
                        </button>
                      ) : (
                        <span className="text-meta text-[var(--color-text-3)] flex items-center gap-1">
                          <UiIcon className="w-3 h-3" icon={Clock} /> {days === 0 ? "Today" : `${days}d ago`}
                        </span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </m.div>
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

