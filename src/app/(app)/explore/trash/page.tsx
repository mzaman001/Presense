"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Icon as UiIcon } from "@/components/ui/Icon";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import { restoreItemPatch } from "@/lib/item-lifecycle";

export default function ExploreTrashPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState<any>(null);

  const fetchTrash = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch deleted explores, items, threads, people, and locations
    const [exploresRes, itemsRes, threadsRes, peopleRes, locationsRes] = await Promise.all([
      // INFRA-18: explicit user_id filter for planner index usage
      supabase.from("explores").select("*").eq("user_id", user.id).eq("status", "deleted").order("deleted_at", { ascending: false }),
      supabase.from("items").select("*").eq("user_id", user.id).eq("status", "deleted").order("deleted_at", { ascending: false }),
      supabase.from("threads").select("*").eq("user_id", user.id).eq("status", "deleted").order("deleted_at", { ascending: false }),
      supabase.from("people").select("*").eq("user_id", user.id).eq("status", "deleted").order("deleted_at", { ascending: false }),
      supabase.from("locations").select("*").eq("user_id", user.id).eq("status", "deleted").order("deleted_at", { ascending: false })
    ]);

    const combined = [
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(exploresRes.data || []).map((i: any) => ({ ...i, __type: 'explore' })),
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(itemsRes.data || []).map((i: any) => ({ ...i, __type: 'item' })),
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(threadsRes.data || []).map((i: any) => ({ ...i, __type: 'thread' })),
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(peopleRes.data || []).map((i: any) => ({ ...i, __type: 'person' })),
      /* @todo: Untyped usage justified per TOOL-01 */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(locationsRes.data || []).map((i: any) => ({ ...i, __type: 'location' }))
    /* @todo: Untyped usage justified per TOOL-01 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ].sort((a: any, b: any) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    setItems(combined);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  /* @todo: Untyped usage justified per TOOL-01 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRestore = async (item: any) => {
    try {
      const table = item.__type === 'explore' ? 'explores' : 
                    item.__type === 'item' ? 'items' : 
                    item.__type === 'thread' ? 'threads' : 
                    item.__type === 'person' ? 'people' : 'locations';
      const { error } = await supabase.from(table).update(restoreItemPatch()).eq("id", item.id);
      if (error) throw error;
      setItems(items.filter(i => i.id !== item.id));
      toast.success("Item restored");
    } catch (err: unknown) {
      toast.error("Failed to restore", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToPermanentDelete) return;
    try {
      const table = itemToPermanentDelete.__type === 'explore' ? 'explores' : 
                    itemToPermanentDelete.__type === 'item' ? 'items' : 
                    itemToPermanentDelete.__type === 'thread' ? 'threads' : 
                    itemToPermanentDelete.__type === 'person' ? 'people' : 'locations';
      const { error } = await supabase.from(table).delete().eq("id", itemToPermanentDelete.id);
      if (error) throw error;
      setItems(items.filter(i => i.id !== itemToPermanentDelete.id));
      toast.success("Permanently deleted");
    } catch (err: unknown) {
      toast.error("Failed to delete", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setItemToPermanentDelete(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <header className="mb-8">
        <Link href="/explore" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors mb-4">
          <UiIcon className="w-4 h-4" icon={ArrowLeft} /> Back to Explore
        </Link>
        <h1 className="text-page-greeting text-[var(--text-1)]">Trash</h1>
        <p className="text-[var(--color-text-3)] mt-1">Items deleted in the last 30 days. After 30 days, they are permanently removed.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <UiIcon className="w-8 h-8 animate-spin text-[var(--color-text-3)]" icon={Loader2} />
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="p-12 text-center border-dashed border-[var(--color-border)]">
          <UiIcon className="w-8 h-8 text-[var(--color-text-3)] mx-auto mb-4" icon={Trash2} />
          <h3 className="text-section-title text-[var(--text-1)] mb-2">Trash is empty</h3>
          <p className="text-sm text-[var(--color-text-3)]">Nothing to see here.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <GlassCard key={item.id} className="p-4 flex items-center justify-between group">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-caption uppercase tracking-widest px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-3)]">
                    {item.__type}
                  </span>
                  <h4 className="text-card-title text-[var(--text-1)]">{item.title || item.name}</h4>
                </div>
                <p className="text-xs text-[var(--color-text-3)] mt-1">
                  Deleted: {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : "Unknown"}
                </p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleRestore(item)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <UiIcon className="w-3.5 h-3.5" icon={RefreshCw} /> Restore
                </button>
                <button
                  onClick={() => setItemToPermanentDelete(item)}
                  className="px-3 py-1.5 rounded-lg bg-[#F87171]/10 text-[#F87171] hover:bg-[#F87171]/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <UiIcon className="w-3.5 h-3.5" icon={Trash2} /> Delete Forever
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

