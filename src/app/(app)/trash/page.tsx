"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@/components/providers/SessionProvider";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import { restoreItemPatch } from "@/lib/item-lifecycle";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The five soft-deletable entities. `table` is the Supabase table; `type` is
 * the value per-space pointers pass as `?filter=`.
 */
const TRASH_SOURCES = [
  { type: "explore", table: "explores", label: "Explore", nameColumn: "title" },
  { type: "item", table: "items", label: "Task", nameColumn: "title" },
  { type: "thread", table: "threads", label: "Thread", nameColumn: "title" },
  { type: "person", table: "people", label: "Person", nameColumn: "name" },
  {
    type: "location",
    table: "locations",
    label: "Location",
    nameColumn: "name",
  },
] as const;

type TrashType = (typeof TRASH_SOURCES)[number]["type"];
type TrashTable = (typeof TRASH_SOURCES)[number]["table"];

interface TrashEntry {
  id: string;
  /** Display name, read from each table's own title/name column. */
  label: string;
  typeLabel: string;
  deletedAt: string | null;
  type: TrashType;
  table: TrashTable;
}

function isTrashType(value: string | null): value is TrashType {
  return TRASH_SOURCES.some((source) => source.type === value);
}

export default function TrashPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  // Per-space pointers link here with ?filter=<type> to scope the view.
  const filterParam = searchParams.get("filter");
  const filterType = isTrashType(filterParam) ? filterParam : null;

  const [itemToPermanentDelete, setItemToPermanentDelete] =
    useState<TrashEntry | null>(null);

  const {
    data: items = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    // The filter is part of the key: a scoped view queries only its own
    // table rather than fetching all five and discarding four client-side.
    queryKey: ["trash", filterType],
    queryFn: async (): Promise<TrashEntry[]> => {
      const sources = filterType
        ? TRASH_SOURCES.filter((source) => source.type === filterType)
        : TRASH_SOURCES;

      const results = await Promise.all(
        sources.map(async (source) => {
          // Narrow projection: the list shows a name and a date, so there is
          // no reason to pull whole rows across the wire. The select string
          // is a literal per branch so the generated Database types still
          // check the columns.
          const query = supabase
            .from(source.table)
            .select(
              source.nameColumn === "title"
                ? "id, deleted_at, title"
                : "id, deleted_at, name",
            )
            .eq("user_id", userId)
            .eq("status", "deleted")
            .order("deleted_at", { ascending: false })
            .limit(200)
            // The select string varies per table, so the generated row type
            // widens to a union the builder cannot narrow. The columns are
            // still checked against Database above; this only pins the shape
            // the mapper below reads.
            .overrideTypes<
              {
                id: string;
                deleted_at: string | null;
                title?: string | null;
                name?: string | null;
              }[]
            >();

          const { data, error: queryError } = await query;

          // Surface the failure instead of rendering "Trash is empty" — the
          // old code swallowed every error with `|| []`, so a broken query
          // was indistinguishable from an actually empty trash.
          if (queryError) throw queryError;

          return (data ?? []).map((row): TrashEntry => ({
            id: row.id,
            label: row.title ?? row.name ?? "Untitled",
            typeLabel: source.label,
            deletedAt: row.deleted_at,
            type: source.type,
            table: source.table,
          }));
        }),
      );

      return results
        .flat()
        .sort(
          (a, b) =>
            new Date(b.deletedAt ?? 0).getTime() -
            new Date(a.deletedAt ?? 0).getTime(),
        );
    },
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
          Items you&apos;ve deleted. Restore or remove them permanently.
        </p>
      </header>

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
              className="group flex flex-wrap items-center justify-between gap-3 p-4"
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
                  Deleted:{" "}
                  {entry.deletedAt
                    ? new Date(entry.deletedAt).toLocaleDateString()
                    : "Unknown"}
                </p>
              </div>
              <div className="row-actions flex items-center gap-2">
                <button
                  onClick={() => handleRestore(entry)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[var(--color-accent)]/10 px-3 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20"
                >
                  <UiIcon className="h-3.5 w-3.5" icon={RefreshCw} />
                  Restore
                </button>
                <button
                  onClick={() => setItemToPermanentDelete(entry)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#F87171]/10 px-3 text-xs font-medium text-[#F87171] transition-colors hover:bg-[#F87171]/20"
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
    </div>
  );
}
