"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import { restoreItemPatch } from "@/lib/item-lifecycle";
import { Icon as UiIcon } from "@/components/ui/Icon";

const TYPE_LABELS: Record<string, string> = {
  explore: "Explore",
  item: "Task",
  thread: "Thread",
  person: "Person",
  location: "Location",
};

export default function TrashPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  // BUG-08 / CONF-10 (Option C): per-space pointers link here with
  // ?filter=<type> to show only that entity type in the trash.
  const filterType = searchParams.get("filter");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState<any>(null);

  const fetchTrash = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // BUG-08: a single status value + deleted_at convention across all five
    // tables. fetchType is only a *view* preference (all five are always
    // fetched — per-space views are a browsing surface, not separate logic).
    const fetchType =
      filterType === "explore" ||
      filterType === "item" ||
      filterType === "thread" ||
      filterType === "person" ||
      filterType === "location"
        ? filterType
        : null;

    // Fetch deleted explores, items, threads, people, and locations
    const [exploresRes, itemsRes, threadsRes, peopleRes, locationsRes] =
      await Promise.all([
        supabase
          .from("explores")
          .select("*")
          .eq("user_id", user.id) // INFRA-18
          .eq("status", "deleted")
          .order("deleted_at", { ascending: false }),
        supabase
          .from("items")
          .select("*")
          .eq("user_id", user.id) // INFRA-18
          .eq("status", "deleted")
          .order("deleted_at", { ascending: false }),
        supabase
          .from("threads")
          .select("*")
          .eq("user_id", user.id) // INFRA-18
          .eq("status", "deleted")
          .order("deleted_at", { ascending: false }),
        supabase
          .from("people")
          .select("*")
          .eq("user_id", user.id) // INFRA-18
          .eq("status", "deleted")
          .order("deleted_at", { ascending: false }),
        supabase
          .from("locations")
          .select("*")
          .eq("user_id", user.id) // INFRA-18
          .eq("status", "deleted")
          .order("deleted_at", { ascending: false }),
      ]);

    const combined = [
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(exploresRes.data || []).map((i: any) => ({
        ...i,
        __type: "explore",
      })),
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(itemsRes.data || []).map((i: any) => ({ ...i, __type: "item" })),
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(threadsRes.data || []).map((i: any) => ({ ...i, __type: "thread" })),
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(peopleRes.data || []).map((i: any) => ({ ...i, __type: "person" })),
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(locationsRes.data || []).map((i: any) => ({
        ...i,
                __type: "location",
      })),
      /* @todo: Untyped usage justified per TOOL-01 */
    ]
      .filter((i: any) => (fetchType ? i.__type === fetchType : true))
      .sort(
        (a: any, b: any) =>
          new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime(),
      );

    setItems(combined);
    setLoading(false);
  }, [supabase, filterType]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  /* @todo: Untyped usage justified per TOOL-01 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRestore = async (item: any) => {
    try {
      const table =
        item.__type === "explore"
          ? "explores"
          : item.__type === "item"
            ? "items"
            : item.__type === "thread"
              ? "threads"
              : item.__type === "person"
                ? "people"
                : "locations";
      const { error } = await supabase
        .from(table)
        .update(restoreItemPatch())
        .eq("id", item.id);
      if (error) throw error;
      setItems(items.filter((i) => i.id !== item.id));
      toast.success("Item restored");
    } catch (err: unknown) {
      toast.error("Failed to restore", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToPermanentDelete) return;
    try {
      const table =
        itemToPermanentDelete.__type === "explore"
          ? "explores"
          : itemToPermanentDelete.__type === "item"
            ? "items"
            : itemToPermanentDelete.__type === "thread"
              ? "threads"
              : itemToPermanentDelete.__type === "person"
                ? "people"
                : "locations";
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", itemToPermanentDelete.id);
      if (error) throw error;
      setItems(items.filter((i) => i.id !== itemToPermanentDelete.id));
      toast.success("Permanently deleted");
    } catch (err: unknown) {
      toast.error("Failed to delete", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setItemToPermanentDelete(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-4xl space-y-6 duration-500">
      <header className="mb-8">
        <h1 className="text-page-greeting flex items-center gap-3 text-[var(--text-1)]">
          <UiIcon
            className="h-6 w-6 text-[var(--color-text-3)]"
            icon={Trash2}
          />
          Trash
        </h1>
        <p className="mt-1 text-[var(--color-text-3)]">
          Items you've deleted. Restore or remove them permanently.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <UiIcon
            className="h-8 w-8 animate-spin text-[var(--color-text-3)]"
            icon={Loader2}
          />
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="border-dashed border-[var(--color-border)] p-12 text-center">
          <UiIcon
            className="mx-auto mb-4 h-8 w-8 text-[var(--color-text-3)]"
            icon={Trash2}
          />
          <h3 className="text-section-title mb-2 text-[var(--text-1)]">
            Trash is empty
          </h3>
          <p className="text-sm text-[var(--color-text-3)]">
            Nothing to see here.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <GlassCard
              key={item.id}
              className="group flex items-center justify-between p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-caption rounded border border-[var(--color-border)] px-2 py-0.5 tracking-widest text-[var(--color-text-3)] uppercase">
                    {TYPE_LABELS[item.__type] ?? item.__type}
                  </span>
                  <h4 className="text-card-title text-[var(--text-1)]">
                    {item.title || item.name}
                  </h4>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-3)]">
                  Deleted:{" "}
                  {item.deleted_at
                    ? new Date(item.deleted_at).toLocaleDateString()
                    : "Unknown"}
                </p>
              </div>
              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => handleRestore(item)}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20"
                >
                  <UiIcon className="h-3.5 w-3.5" icon={RefreshCw} /> Restore
                </button>
                <button
                  onClick={() => setItemToPermanentDelete(item)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#F87171]/10 px-3 py-1.5 text-xs font-medium text-[#F87171] transition-colors hover:bg-[#F87171]/20"
                >
                  <UiIcon className="h-3.5 w-3.5" icon={Trash2} /> Delete
                  Forever
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!itemToPermanentDelete}
        onClose={() => setItemToPermanentDelete(null)}
        onConfirm={handlePermanentDelete}
        title="Permanent Delete"
        description="Are you sure you want to permanently delete this item? This action cannot be undone."
        confirmLabel="Delete Forever"
        confirmDestructive
      />
    </div>
  );
}
