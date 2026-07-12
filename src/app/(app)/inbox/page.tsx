"use client";

import { createPortal } from "react-dom";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createClient, safeMutate } from "@/lib/supabase";
import {
  Inbox,
  Loader2,
  FolderInput,
  CheckCircle2,
  MessageSquare,
  Compass,
  Brain,
  X,
  MapPin,
  Trash2,
} from "lucide-react";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { m, useMotionValue, useTransform, animate } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { moveItemToTrashPatch } from "@/lib/item-lifecycle";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface InboxItem {
  id: string;
  title: string;
  user_id: string;
}

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
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
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
        className="absolute inset-0 flex items-center justify-end overflow-hidden rounded-2xl pr-5"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
          opacity: deleteOpacity,
        }}
      >
        <m.div style={{ scale: deleteScale }}>
          <UiIcon className="h-5 w-5 text-red-400" icon={Trash2} />
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
        <div className="glass-card group flex flex-col items-start justify-between gap-4 !overflow-visible rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 transition-colors hover:bg-amber-500/10 md:flex-row md:items-center">
          <p className="text-card-title flex-1 text-lg text-[var(--text-1)]">
            {item.title}
          </p>
          <div className="flex w-full shrink-0 items-center gap-2 opacity-100 transition-opacity md:w-auto md:opacity-0 md:group-hover:opacity-100">
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
                  className="dropdown-panel animate-in fade-in zoom-in-95 z-[9999] w-48 p-1 duration-100"
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
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "explore");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-explore)]"
                      icon={Compass}
                    />{" "}
                    Explore (Saved)
                  </button>
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "remember");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-people)]"
                      icon={Brain}
                    />{" "}
                    Remember (Person)
                  </button>
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "location");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-people)]"
                      icon={MapPin}
                    />{" "}
                    Locations
                  </button>
                </div>,
                document.body,
              )}
            <Button
              variant="icon"
              onClick={() => dismissInboxItem(item.id)}
              className="shrink-0 !border-transparent !bg-transparent hover:!bg-red-500/10 hover:!text-red-400"
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

export default function InboxPage() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("status", "inbox")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InboxItem[];
    },
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
              supabase.from("items").update({ status: "active" }).eq("id", id),
            "Failed to route to Do",
          );
          if (!success) throw new Error("Route to Do failed");
        } else if (space === "remember") {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            // BUG-38: insert FIRST, trash original only on success
            const { data: inserted, error: insertError } = await supabase
              .from("people")
              .insert({
                user_id: user.id,
                name: item.title,
                notes: [
                  {
                    text: item.title,
                    created_at: new Date().toISOString(),
                    tag: "note",
                  },
                ],
              })
              .select("id")
              .single();

            if (insertError) throw insertError;
            if (inserted) {
              routedId = inserted.id;
              await safeMutate(
                () =>
                  supabase
                    .from("items")
                    .update(moveItemToTrashPatch())
                    .eq("id", id),
                "Routed, but failed to remove from Inbox",
              );
            }
          }
        } else if (space === "explore") {
          // BUG-38: insert FIRST, trash original only on success
          const { data: inserted, error: insertError } = await supabase
            .from("explores")
            .insert({
              user_id: item.user_id,
              title: item.title,
              type: "other",
              status: "active",
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          if (inserted) {
            routedId = inserted.id;
            await safeMutate(
              () =>
                supabase
                  .from("items")
                  .update(moveItemToTrashPatch())
                  .eq("id", id),
              "Routed, but failed to remove from Inbox",
            );
          }
        } else if (space === "think") {
          // BUG-38: insert FIRST, trash original only on success
          const { data: inserted, error: insertError } = await supabase
            .from("threads")
            .insert({
              user_id: item.user_id,
              title: item.title,
              status: "active",
              color_accent: "#2DD4BF",
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          if (inserted) {
            routedId = inserted.id;
            await safeMutate(
              () =>
                supabase
                  .from("items")
                  .update(moveItemToTrashPatch())
                  .eq("id", id),
              "Routed, but failed to remove from Inbox",
            );
          }
        } else if (space === "location") {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            // BUG-38: insert FIRST, trash original only on success
            const { data: inserted, error: insertError } = await supabase
              .from("locations")
              .insert({
                user_id: user.id,
                item_name: item.title,
                location_text: item.title,
              })
              .select("id")
              .single();

            if (insertError) throw insertError;
            if (inserted) {
              routedId = inserted.id;
              await safeMutate(
                () =>
                  supabase
                    .from("items")
                    .update(moveItemToTrashPatch())
                    .eq("id", id),
                "Routed, but failed to remove from Inbox",
              );
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
                  await supabase
                    .from("items")
                    .update({ status: "inbox" })
                    .eq("id", id);
                } else if (space === "remember") {
                  if (routedId) {
                    await supabase.from("people").delete().eq("id", routedId);
                  }
                  await supabase
                    .from("items")
                    .update({ status: "inbox" })
                    .eq("id", id);
                } else if (space === "explore") {
                  if (routedId) {
                    await supabase.from("explores").delete().eq("id", routedId);
                  }
                  await supabase
                    .from("items")
                    .update({ status: "inbox" })
                    .eq("id", id);
                } else if (space === "think") {
                  if (routedId) {
                    await supabase.from("threads").delete().eq("id", routedId);
                  }
                  await supabase
                    .from("items")
                    .update({ status: "inbox" })
                    .eq("id", id);
                } else if (space === "location") {
                  if (routedId) {
                    await supabase
                      .from("locations")
                      .delete()
                      .eq("id", routedId);
                  }
                  await supabase
                    .from("items")
                    .update({ status: "inbox" })
                    .eq("id", id);
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
                .update({ status: "inbox" })
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
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-caption mb-1 font-semibold tracking-widest text-[rgba(255,255,255,0.35)] uppercase">
            Space
          </p>
          <div className="flex items-center gap-4">
            <h1 className="flex items-center gap-2 text-[22px] font-medium tracking-tight text-[var(--color-text-1)]">
              <UiIcon size={22} className="text-[var(--accent)]" icon={Inbox} />
              Inbox
            </h1>
          </div>
        </div>
      </div>

      <ContextualTip
        id="inbox_space"
        title="Unload your brain"
        description="Dump everything here. Process them later by routing them to the Do, Think, or Explore space."
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
            <GlassCard className="flex flex-col items-center justify-center border-dashed border-[rgba(255,255,255,0.08)] p-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.03)]">
                <UiIcon
                  className="h-6 w-6 text-[var(--color-text-3)]"
                  icon={CheckCircle2}
                />
              </div>
              <h3 className="mb-2 font-medium text-[var(--color-text-1)]">
                Inbox Zero
              </h3>
              <p className="max-w-sm text-sm text-[var(--color-text-3)]">
                You&apos;ve processed everything. Your mind is clear for the day
                ahead.
              </p>
            </GlassCard>
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
