"use client";

import { createPortal } from "react-dom";
import { useUserId } from "@/components/providers/SessionProvider";
import React, { use, useState, useMemo, useEffect, useRef } from "react";
import { createClient, safeMutate } from "@/lib/supabase";
import {
  Loader2,
  FolderInput,
  CheckCircle2,
  MessageSquare,
  Brain,
  X,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { m, useMotionValue, useTransform, animate } from "framer-motion";
// INFRA-19: all status writes on entity tables go through item-lifecycle.ts
import {
  moveItemToTrashPatch,
  activateItemPatch,
  restoreItemPatch,
} from "@/lib/item-lifecycle";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

import { fetchInboxItems, type InboxItem } from "@/lib/inbox-items";

const InboxItemCard = ({
  item,
  slidingOut,
  activeRouteItem,
  setActiveRouteItem,
  routeInboxItem,
  dismissInboxItem,
}: {
  item: InboxItem;
  slidingOut: string | null;
  activeRouteItem: string | null;
  setActiveRouteItem: (id: string | null) => void;
  routeInboxItem: (id: string, space: string) => void;
  dismissInboxItem: (id: string) => void;
}) => {
  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [0, -80], [0, 1]);
  const deleteScale = useTransform(dragX, [0, -80], [0.7, 1]);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  /* @todo: Untyped usage justified per TOOL-01 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragEnd = async (_: any, info: any) => {
    if (info.offset.x < -80) {
      animate(dragX, -300, { duration: 0.2 });
      dismissInboxItem(item.id);
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 40 });
    }
  };

  return (
    <m.div
      layout
      layoutId={item.id}
      initial={{ opacity: 0, y: 8 }}
      animate={
        slidingOut === item.id
          ? { opacity: 0, x: 60, scale: 0.96 }
          : { opacity: 1, y: 0, x: 0, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative rounded-2xl"
    >
      {/* Swipe-to-delete reveal layer */}
      <m.div
        className="absolute inset-0 flex items-center justify-end overflow-hidden rounded-2xl bg-[var(--status-danger-dim)] pr-5"
        style={{ opacity: deleteOpacity }}
      >
        <m.div style={{ scale: deleteScale }}>
          <UiIcon
            className="h-5 w-5 text-[var(--status-danger)]"
            icon={Trash2}
          />
        </m.div>
      </m.div>

      {/* Draggable content */}
      <m.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="relative"
      >
        <div className="glass-card group flex flex-col items-start justify-between gap-4 rounded-2xl p-4 transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)] md:flex-row md:items-center">
          <p className="text-card-title flex-1 text-lg text-[var(--text-1)]">
            {item.title}
          </p>
          <div className="row-actions flex w-full shrink-0 items-center gap-2 md:w-auto">
            <Button
              variant="secondary"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                const rect = (
                  e.currentTarget as HTMLElement
                ).getBoundingClientRect();
                setDropdownRect(rect);
                setActiveRouteItem(
                  activeRouteItem === item.id ? null : item.id,
                );
              }}
            >
              <UiIcon className="h-3.5 w-3.5" icon={FolderInput} />
              Route it
            </Button>
            {activeRouteItem === item.id &&
              dropdownRect &&
              createPortal(
                <div
                  className="dropdown-panel animate-in fade-in zoom-in-[0.97] z-[220] w-52 p-1 duration-150"
                  style={{
                    position: "fixed",
                    top: dropdownRect.bottom + 4,
                    left: dropdownRect.right - 192,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "do");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-do)]"
                      icon={CheckCircle2}
                    />{" "}
                    Do (Task)
                  </button>
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "remember");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-text-3)]"
                      icon={Brain}
                    />{" "}
                    Remember
                  </button>
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "think");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-think)]"
                      icon={MessageSquare}
                    />{" "}
                    Think (Thread)
                  </button>
                </div>,
                document.body,
              )}
            <Button
              variant="ghost"
              onClick={() => dismissInboxItem(item.id)}
              className="shrink-0 !border-transparent !bg-transparent hover:!bg-[var(--status-danger)]/10 hover:!text-[var(--status-danger)]"
              title="Dismiss"
            >
              <UiIcon className="h-4 w-4" icon={X} />
            </Button>
          </div>
        </div>
      </m.div>
    </m.div>
  );
};

export function InboxView({
  itemsPromise,
}: {
  /** Streamed by the server page; undefined when that fetch failed. */
  itemsPromise: Promise<InboxItem[] | undefined>;
}) {
  const userId = useUserId();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  // A cached list renders at once; only a cold load reads the stream.
  const serverItems = queryClient.getQueryData(["inbox-tasks"])
    ? undefined
    : use(itemsPromise);

  const [activeRouteItem, setActiveRouteItem] = useState<string | null>(null);
  const [slidingOut, setSlidingOut] = useState<string | null>(null);
  const activeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        activeRouteItem &&
        activeDropdownRef.current &&
        !activeDropdownRef.current.contains(event.target as Node)
      ) {
        setActiveRouteItem(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeRouteItem]);

  const {
    data: inboxItems = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["inbox-tasks"],
    queryFn: () => fetchInboxItems(supabase, userId),
    initialData: serverItems,
  });

  useRealtime("items", refetch);

  const routeInboxItem = async (id: string, space: string) => {
    if (!space) return;

    const item = inboxItems.find((i) => i.id === id);
    if (!item) return;

    setSlidingOut(id);
    setActiveRouteItem(null);

    setTimeout(async () => {
      queryClient.setQueryData<InboxItem[]>(
        ["inbox-tasks"],
        (old) => old?.filter((i) => i.id !== id) ?? [],
      );

      try {
        let routedId: string | null = null;

        if (space === "do") {
          // BUG-38: check error — was fire-and-forget before
          const { success } = await safeMutate(
            () =>
              supabase.from("items").update(activateItemPatch()).eq("id", id),
            "Failed to route to Do",
          );
          if (!success) throw new Error("Route to Do failed");
        } else if (space === "remember") {
          // PERF-17: item.user_id is already in hand from the inbox query
          // — drop the redundant supabase.auth.getUser() round trip.
          if (item.user_id) {
            // BUG-38: insert FIRST, trash original only on success
            const { data: inserted, error: insertError } = await supabase
              .from("locations")
              .insert({
                user_id: item.user_id,
                item_name: item.title,
                location_text: item.title,
              })
              .select("id")
              .single();

            if (insertError) throw insertError;
            if (inserted) {
              routedId = inserted.id;
              const { success: trashed } = await safeMutate(
                () =>
                  supabase
                    .from("items")
                    .update(moveItemToTrashPatch())
                    .eq("id", id),
                "Routed, but failed to remove from Inbox",
              );
              if (!trashed) {
                const destId = routedId;
                if (destId) {
                  await safeMutate(
                    () => supabase.from("locations").delete().eq("id", destId),
                    "Failed to undo route",
                  );
                }
                throw new Error("Failed to remove from Inbox");
              }
            }
          }
        } else if (space === "think") {
          // BUG-38: insert FIRST, trash original only on success
          const { data: inserted, error: insertError } = await supabase
            .from("threads")
            .insert({
              user_id: item.user_id,
              title: item.title,
              color_accent: "#e3875f",
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          if (inserted) {
            routedId = inserted.id;
            const { success: trashed } = await safeMutate(
              () =>
                supabase
                  .from("items")
                  .update(moveItemToTrashPatch())
                  .eq("id", id),
              "Routed, but failed to remove from Inbox",
            );
            if (!trashed) {
              const destId = routedId;
              if (destId) {
                await safeMutate(
                  () => supabase.from("threads").delete().eq("id", destId),
                  "Failed to undo route",
                );
              }
              throw new Error("Failed to remove from Inbox");
            }
          }
        }

        toast.success(`Routed to ${space}`, {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                if (space === "do") {
                  await safeMutate(
                    () =>
                      supabase
                        .from("items")
                        .update(restoreItemPatch("inbox"))
                        .eq("id", id),
                    "Failed to restore to inbox",
                  );
                } else if (space === "remember") {
                  if (routedId) {
                    await safeMutate(
                      () =>
                        supabase.from("locations").delete().eq("id", routedId),
                      "Failed to undo route",
                    );
                  }
                  await safeMutate(
                    () =>
                      supabase
                        .from("items")
                        .update(restoreItemPatch("inbox"))
                        .eq("id", id),
                    "Failed to restore to inbox",
                  );
                } else if (space === "think") {
                  if (routedId) {
                    await safeMutate(
                      () =>
                        supabase.from("threads").delete().eq("id", routedId),
                      "Failed to undo route",
                    );
                  }
                  await safeMutate(
                    () =>
                      supabase
                        .from("items")
                        .update(restoreItemPatch("inbox"))
                        .eq("id", id),
                    "Failed to restore to inbox",
                  );
                }
                queryClient.setQueryData<InboxItem[]>(
                  ["inbox-tasks"],
                  (old) => [item, ...(old ?? [])],
                );
                toast.success("Restored to inbox");
              } catch {
                toast.error("Failed to undo");
                refetch();
              }
            },
          },
        });
      } catch {
        queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], (old) => [
          item,
          ...(old ?? []),
        ]);
        toast.error("Failed to route item");
      } finally {
        setSlidingOut(null);
      }
    }, 280);
  };

  const dismissInboxItem = async (id: string) => {
    const item = inboxItems.find((i) => i.id === id);
    if (!item) return;

    queryClient.setQueryData<InboxItem[]>(
      ["inbox-tasks"],
      (old) => old?.filter((i) => i.id !== id) ?? [],
    );

    try {
      const { error } = await supabase
        .from("items")
        .update(moveItemToTrashPatch())
        .eq("id", id);
      if (error) {
        queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], (old) => [
          item,
          ...(old ?? []),
        ]);
        toast.error("Could not dismiss", { description: error.message });
        return;
      }
      toast.success("Dismissed", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const { error: undoError } = await supabase
                .from("items")
                .update(restoreItemPatch("inbox"))
                .eq("id", id);
              if (undoError) {
                toast.error("Could not restore", {
                  description: undoError.message,
                });
                return;
              }
              queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], (old) => [
                item,
                ...(old ?? []),
              ]);
              toast.success("Restored to inbox");
            } catch {
              toast.error("Failed to undo");
              refetch();
            }
          },
        },
      });
    } catch {
      queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], (old) => [
        item,
        ...(old ?? []),
      ]);
      toast.error("Failed to dismiss");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Inbox" />

      <ContextualTip
        id="inbox_space"
        title="Unload your brain"
        description="Put anything here without deciding what it is. Later, send each item to Do, Think or Remember."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <UiIcon
            className="h-6 w-6 animate-spin text-[var(--color-text-3)]"
            icon={Loader2}
          />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4 pt-4">
          {inboxItems.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Inbox zero"
              description="Everything has a place. Your mind is clear for the day ahead."
            />
          ) : (
            inboxItems.map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                slidingOut={slidingOut}
                activeRouteItem={activeRouteItem}
                setActiveRouteItem={setActiveRouteItem}
                routeInboxItem={routeInboxItem}
                dismissInboxItem={dismissInboxItem}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
