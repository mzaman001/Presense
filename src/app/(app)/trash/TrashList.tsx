"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import { restoreItemPatch } from "@/lib/item-lifecycle";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  fetchTrash,
  formatDeletedDate,
  trashQueryKey,
  type TrashEntry,
  type TrashType,
} from "@/lib/trash";

export function TrashList({
  filterType,
  initialEntries,
  timeZone,
}: {
  filterType: TrashType | null;
  /** Server-fetched first page; undefined when that fetch failed. */
  initialEntries: TrashEntry[] | undefined;
  timeZone: string;
}) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const [itemToPermanentDelete, setItemToPermanentDelete] =
    useState<TrashEntry | null>(null);

  const {
    data: items = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: trashQueryKey(filterType),
    queryFn: () => fetchTrash(supabase, userId, filterType),
    initialData: initialEntries,
  });

  const handleRestore = async (entry: TrashEntry) => {
    try {
      const { error: restoreError } = await supabase
        .from(entry.table)
        .update(restoreItemPatch())
        .eq("id", entry.id);
      if (restoreError) throw restoreError;
      // The restored row rejoins its own space, so invalidate broadly rather
      // than splicing it out of one local array.
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      toast.success(`${entry.typeLabel} restored`);
    } catch (err: unknown) {
      toast.error("Failed to restore", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToPermanentDelete) return;
    try {
      const { error: deleteError } = await supabase
        .from(itemToPermanentDelete.table)
        .delete()
        .eq("id", itemToPermanentDelete.id);
      if (deleteError) throw deleteError;
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
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
    <>
      {isPending ? (
        <div
          className="flex items-center justify-center py-20"
          role="status"
          aria-label="Loading trash"
        >
          <UiIcon
            className="h-8 w-8 animate-spin text-[var(--color-text-3)]"
            icon={Loader2}
          />
        </div>
      ) : isError ? (
        /* A failed query used to render as "Trash is empty", which quietly
           told the user their deleted items were gone. Say what happened
           and offer a retry instead. */
        <GlassCard className="border-dashed border-[var(--color-border)] p-12 text-center">
          <h3 className="text-section-title mb-2 text-[var(--text-1)]">
            Couldn&apos;t load your trash
          </h3>
          <p className="mb-4 text-sm text-[var(--color-text-3)]">
            {error instanceof Error
              ? error.message
              : "Something went wrong reaching the server."}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[var(--color-accent)]/10 px-4 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20"
          >
            <UiIcon className="h-4 w-4" icon={RefreshCw} /> Try again
          </button>
        </GlassCard>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="Items you delete land here first, so nothing is lost by accident."
        />
      ) : (
        <div className="space-y-3">
          {items.map((entry) => (
            <GlassCard
              key={`${entry.type}-${entry.id}`}
              className="group flex flex-col items-start gap-3 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-caption rounded border border-[var(--color-border)] px-2 py-0.5 tracking-widest text-[var(--color-text-3)] uppercase">
                    {entry.typeLabel}
                  </span>
                  <h4 className="text-card-title truncate text-[var(--text-1)]">
                    {entry.label}
                  </h4>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-3)]">
                  Deleted: {formatDeletedDate(entry.deletedAt, timeZone)}
                </p>
              </div>
              <div className="row-actions flex w-full shrink-0 items-center gap-2 md:w-auto">
                <button
                  onClick={() => handleRestore(entry)}
                  className="flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)]/10 px-3 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20 md:flex-none"
                >
                  <UiIcon className="h-3.5 w-3.5" icon={RefreshCw} />
                  Restore
                </button>
                <button
                  onClick={() => setItemToPermanentDelete(entry)}
                  className="flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--status-danger-dim)] px-3 text-xs font-medium text-[var(--status-danger)] transition-colors hover:bg-[var(--status-danger-border)] md:flex-none"
                >
                  <UiIcon className="h-3.5 w-3.5" icon={Trash2} />
                  Delete forever
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
    </>
  );
}
