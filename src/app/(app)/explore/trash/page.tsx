"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function ExploreTrashPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState<any>(null);

  const fetchTrash = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch deleted explores, items, and threads
    const [exploresRes, itemsRes, threadsRes] = await Promise.all([
      supabase.from("explores").select("*").eq("status", "deleted").order("deleted_at", { ascending: false }),
      supabase.from("items").select("*").eq("status", "deleted").order("deleted_at", { ascending: false }),
      supabase.from("threads").select("*").eq("status", "deleted").order("deleted_at", { ascending: false })
    ]);

    const combined = [
      ...(exploresRes.data || []).map(i => ({ ...i, __type: 'explore' })),
      ...(itemsRes.data || []).map(i => ({ ...i, __type: 'item' })),
      ...(threadsRes.data || []).map(i => ({ ...i, __type: 'thread' }))
    ].sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    setItems(combined);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  const handleRestore = async (item: any) => {
    try {
      const table = item.__type === 'explore' ? 'explores' : item.__type === 'item' ? 'items' : 'threads';
      const statusToRestore = item.__type === 'item' ? 'active' : 'active';
      const { error } = await supabase.from(table).update({ status: statusToRestore, deleted_at: null }).eq("id", item.id);
      if (error) throw error;
      setItems(items.filter(i => i.id !== item.id));
      toast.success("Item restored");
    } catch (err: any) {
      toast.error("Failed to restore", { description: err.message });
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToPermanentDelete) return;
    try {
      const table = itemToPermanentDelete.__type === 'explore' ? 'explores' : itemToPermanentDelete.__type === 'item' ? 'items' : 'threads';
      const { error } = await supabase.from(table).delete().eq("id", itemToPermanentDelete.id);
      if (error) throw error;
      setItems(items.filter(i => i.id !== itemToPermanentDelete.id));
      toast.success("Permanently deleted");
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    } finally {
      setItemToPermanentDelete(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <header className="mb-8">
        <Link href="/explore" className="inline-flex items-center gap-2 text-sm text-[rgba(255,255,255,0.4)] hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Explore
        </Link>
        <h1 className="text-page-title text-3xl">Trash</h1>
        <p className="text-[var(--color-text-3)] mt-1">Items deleted in the last 30 days. After 30 days, they are permanently removed.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[rgba(255,255,255,0.2)]" />
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="p-12 text-center border-dashed border-[rgba(255,255,255,0.1)]">
          <Trash2 className="w-8 h-8 text-[rgba(255,255,255,0.2)] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Trash is empty</h3>
          <p className="text-sm text-[rgba(255,255,255,0.4)]">Nothing to see here.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <GlassCard key={item.id} className="p-4 flex items-center justify-between group">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)]">
                    {item.__type}
                  </span>
                  <h4 className="text-sm font-medium text-white">{item.title}</h4>
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
                  <RefreshCw className="w-3.5 h-3.5" /> Restore
                </button>
                <button
                  onClick={() => setItemToPermanentDelete(item)}
                  className="px-3 py-1.5 rounded-lg bg-[#F87171]/10 text-[#F87171] hover:bg-[#F87171]/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Forever
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
