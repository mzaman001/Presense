"use client";

import React, { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@/components/providers/SessionProvider";
import { m, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  Search,
  Plus,
  Loader2,
  Clock,
  AlertCircle,
  MapPin,
  Trash2,
  Key,
  Wallet,
  Smartphone,
  Plug,
  Laptop,
  Headphones,
  Notebook,
  Book,
  Glasses,
  Watch,
  Briefcase,
  CreditCard,
  IdCard,
  Plane,
  PenTool,
  Baby,
  Umbrella,
  Footprints,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { StaleResurfaceBadge } from "@/components/ui/StaleResurfaceBadge";
import { cn, ilikeContains } from "@/lib/utils";
import { LocationAddPanel } from "@/components/features/LocationAddPanel";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

interface LocationItem {
  id: string;
  item_name: string;
  location_text: string;
  updated_at: string | null;
}

const ICON_MAP: Record<string, React.ElementType> = {
  keys: Key,
  key: Key,
  wallet: Wallet,
  phone: Smartphone,
  charger: Plug,
  laptop: Laptop,
  headphones: Headphones,
  notebook: Notebook,
  book: Book,
  glasses: Glasses,
  watch: Watch,
  bag: Briefcase,
  card: CreditCard,
  id: IdCard,
  passport: Plane,
  cable: Plug,
  pen: PenTool,
  bottle: Baby,
  umbrella: Umbrella,
  shoes: Footprints,
};

function getIcon(name: string): React.ElementType {
  const lower = name.toLowerCase();
  return (
    Object.entries(ICON_MAP).find(([k]) => lower.includes(k))?.[1] ?? Package
  );
}

function daysAgo(dt: string | null): number {
  if (!dt) return 0;
  return Math.floor((Date.now() - new Date(dt).getTime()) / 86400000);
}

export default function LocationsPage() {
  const userId = useUserId();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<LocationItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    data: items = [],
    isPending: loading,
    refetch: fetchItems,
  } = useQuery({
    // The search term is part of the key, so results are cached per term and
    // typing back to a previous query is instant instead of a refetch.
    queryKey: ["locations", search.trim()],
    queryFn: async (): Promise<LocationItem[]> => {
      // INFRA-18: explicit user_id filter for planner index usage.
      // BUG-08: trashed locations must not render in the list on any client.
      let query = supabase
        .from("locations")
        .select("id, item_name, location_text, updated_at")
        .eq("user_id", userId)
        .neq("status", "deleted")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (search.trim()) {
        const term = ilikeContains(search.trim());
        query = query.or(`item_name.ilike.${term},location_text.ilike.${term}`);
      }
      const { data, error } = await query;
      // Previously `?? []` hid every failure behind the empty state.
      if (error) throw error;
      return data ?? [];
    },
    placeholderData: (previous) => previous,
  });

  /**
   * Applies an optimistic change to the cached list for the current search
   * term. The list is query-owned now, so mutations edit the cache rather
   * than a parallel piece of component state.
   */
  const patchLocations = useCallback(
    (update: (items: LocationItem[]) => LocationItem[]) => {
      queryClient.setQueryData<LocationItem[]>(
        ["locations", search.trim()],
        (old) => (old ? update(old) : old),
      );
    },
    [queryClient, search],
  );

  const refresh = useCallback(() => {
    void fetchItems();
  }, [fetchItems]);
  useRealtime("locations", refresh);

  const markStillHere = async (id: string) => {
    try {
      const { error } = await supabase
        .from("locations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      patchLocations((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, updated_at: new Date().toISOString() } : i,
        ),
      );
      toast.success("Location updated");
    } catch (err: unknown) {
      toast.error("Failed to update location", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  /* BUG-44 — optimistic soft delete for the list row (DS-11: no confirm).
     INFRA-19: lifecycle patch is the single source of the trash transition. */
  const deleteLocationItem = async (item: LocationItem) => {
    try {
      patchLocations((prev) => prev.filter((i) => i.id !== item.id));
      const { error } = await supabase
        .from("locations")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("user_id", userId ?? "");
      if (error) throw error;
      toast.success("Location moved to trash");
    } catch {
      toast.error("Failed to delete location");
      void fetchItems();
    }
  };

  const noResults = !loading && items.length === 0 && search.trim();

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Search bar — primary interaction */}
        <div className="relative">
          <UiIcon
            size={13}
            strokeWidth={1.5}
            className="absolute top-1/2 left-4 -translate-y-1/2 text-[var(--text-3)]"
            icon={Search}
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search for anything you've placed somewhere..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-input)] py-3 pr-4 pl-11 text-sm text-[var(--color-text-1)] transition-colors outline-none placeholder:text-[var(--color-text-3)] focus:border-[var(--border-input-focus)]"
          />
        </div>

        {/* Not found state */}
        {noResults && (
          <GlassCard className="border-[var(--accent-border)] p-5">
            <p className="mb-3 text-sm text-[var(--color-text-3)]">
              &ldquo;
              <span className="text-[var(--color-text-1)]">{search}</span>
              &rdquo; not found — log it now?
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hot)]"
            >
              Log &ldquo;{search}&rdquo;
            </button>
          </GlassCard>
        )}

        {/* With nothing logged, the empty state below carries the one call
            to action; a "0 items" header plus a second button was noise. */}
        {(items.length > 0 || search.trim()) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-label text-[var(--text-3)]">
              {items.length} {items.length === 1 ? "place" : "places"}
            </h2>
            {!showAdd && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowAdd(true)}
              >
                <UiIcon className="h-4 w-4" icon={Plus} /> Log item
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-6">
            <PageSkeleton count={4} type="task" />
          </div>
        ) : items.length === 0 && !search.trim() ? (
          <EmptyState
            icon={MapPin}
            title="Nothing to remember yet"
            description="Note where you put something, and let Presense hold onto it for you."
            pointer={
              // BUG-08 / CONF-10 (Option C): thin pointer to the global trash
              <Link
                href="/trash?filter=location"
                className="inline-flex min-h-9 items-center gap-1.5 text-[var(--text-3)] underline underline-offset-4 hover:text-[var(--accent-text)]"
              >
                <UiIcon className="h-3.5 w-3.5" icon={Trash2} />
                Looking for something you deleted?
              </Link>
            }
            action={
              <Button
                variant="primary"
                onClick={() => setShowAdd(true)}
                className="mx-auto gap-2"
              >
                <UiIcon size={16} icon={Plus} /> Log item
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
                <m.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <GlassCard
                    onClick={() => setEditingItem(item)}
                    className={cn(
                      "group relative cursor-pointer px-4 py-3 transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)]",
                      isStale && "border-[var(--status-stale-border)]",
                      isVeryStale && "opacity-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-1)]">
                        {React.createElement(getIcon(item.item_name), {
                          className: "w-4 h-4 text-[var(--color-text-2)]",
                        })}
                      </div>
                      {/* BUG-44 — hover/focus trash affordance; stops propagation
                        so the edit panel doesn't open on delete. */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLocationItem(item);
                        }}
                        aria-label={`Move ${item.item_name} to trash`}
                        className="row-actions relative z-10 hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--status-danger)] hover:bg-[var(--status-danger)]/15 focus-visible:opacity-100 md:flex"
                      >
                        <UiIcon className="h-4 w-4" icon={Trash2} />
                      </button>
                      <div className="min-w-0 flex-1 pr-20">
                        <p
                          className={cn(
                            "text-sm font-semibold text-[var(--color-text-1)]",
                            isVeryStale && "line-through opacity-60",
                          )}
                        >
                          {item.item_name}
                        </p>
                        <p className="truncate text-xs text-[var(--color-text-3)]">
                          {item.location_text}
                        </p>
                      </div>
                      <div className="shrink-0 space-y-1 text-right">
                        {isVeryStale ? (
                          <span className="text-caption flex items-center gap-1 text-[var(--color-text-3)]">
                            <UiIcon className="h-3 w-3" icon={AlertCircle} />{" "}
                            Probably moved?
                          </span>
                        ) : isStale ? (
                          <StaleResurfaceBadge
                            message={null}
                            actionLabel="Stale · Still here"
                            onAction={(e) => {
                              e?.stopPropagation?.();
                              markStillHere(item.id);
                            }}
                            className="relative z-10 !px-2 !py-0.5"
                          />
                        ) : (
                          <span className="text-meta flex items-center gap-1 text-[var(--color-text-3)]">
                            <UiIcon className="h-3 w-3" icon={Clock} />{" "}
                            {days === 0 ? "Today" : `${days}d ago`}
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
