"use client";

import React, { use, useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@/components/providers/SessionProvider";
import { m } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, Loader2, Sparkles, Pin, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useAppStore } from "@/store/useAppStore";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { moveItemToTrashPatch } from "@/lib/item-lifecycle";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { StaleResurfaceBadge } from "@/components/ui/StaleResurfaceBadge";
import {
  fetchThreads as queryThreads,
  threadsQueryKey,
  type Thread,
} from "@/lib/think-threads";

export function ThinkView({
  threadsPromise,
  renderedAt,
}: {
  /** Active threads streamed by the server page; undefined if that failed. */
  threadsPromise: Promise<Thread[] | undefined>;
  /** The server's clock, so "Updated N days ago" matches on hydration. */
  renderedAt: number;
}) {
  const userId = useUserId();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const setPrefetchedThread = useAppStore((s) => s.setPrefetchedThread);
  const [showArchive, setShowArchive] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const view: "active" | "archive" | "trash" = showTrash
    ? "trash"
    : showArchive
      ? "archive"
      : "active";
  const [searchQuery, setSearchQuery] = useState("");

  // A cached list renders at once; only a cold load of the Active view
  // reads the server's stream.
  const serverThreads =
    view === "active" && !queryClient.getQueryData(threadsQueryKey("active"))
      ? use(threadsPromise)
      : undefined;
  const {
    data: threads = [],
    isPending: loading,
    refetch: fetchThreads,
  } = useQuery({
    queryKey: threadsQueryKey(view),
    queryFn: () => queryThreads(supabase, userId, view),
    initialData: serverThreads,
  });
  const setThreads = useCallback(
    (update: (current: Thread[]) => Thread[]) =>
      queryClient.setQueryData<Thread[]>(threadsQueryKey(view), (current) =>
        update(current ?? []),
      ),
    [queryClient, view],
  );

  const filteredThreads = threads.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.entries &&
        t.entries.some((e) =>
          e.text.toLowerCase().includes(searchQuery.toLowerCase()),
        )),
  );

  // Invalidates ["threads"], which covers every view's query.
  useRealtime("threads");

  const timeAgo = (dt: string) => {
    const diff = renderedAt - new Date(dt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const handleDailyNote = async () => {
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const title = `Daily Note: ${dateStr}`;

    // Try insert first — the unique index on (user_id, title) prevents duplicates.
    // If a race condition causes a conflict, fall back to fetching the existing thread.
    const { data: inserted } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        title,
        color_accent: "#FBBF24",
        is_pinned: true,
      })
      .select("id")
      .single();

    if (inserted) {
      router.push(`/think/${inserted.id}`);
      return;
    }

    // Conflict or other error — fetch the existing daily note
    const { data: existingThreads } = await supabase
      .from("threads")
      .select("id")
      .eq("title", title)
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);

    if (existingThreads && existingThreads.length > 0) {
      router.push(`/think/${existingThreads[0].id}`);
    }
  };

  const handleNewThread = async () => {
    const { data, error } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        title: "Untitled Thread",
        color_accent: "#e3875f",
        is_pinned: false,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create thread. Please try again.");
      return;
    }

    if (data) {
      router.push(`/think/${data.id}`);
    }
  };

  /* BUG-44 — optimistic soft delete for the list row; matches the detail
     page's handleDelete (moveItemToTrashPatch, no confirm per DS-11). */
  const deleteThread = useCallback(
    async (thread: Thread) => {
      // Optimistic removal from the list
      setThreads((current) => current.filter((t) => t.id !== thread.id));
      try {
        // INFRA-19: soft delete through the canonical lifecycle patch
        const { error } = await supabase
          .from("threads")
          .update(moveItemToTrashPatch())
          .eq("id", thread.id)
          .eq("user_id", userId);
        if (error) throw error;
        // BUG-08: the global trash lists trashed threads per-space
        toast.success("Thread moved to trash");
      } catch {
        toast.error("Failed to delete thread");
        fetchThreads();
      }
    },
    [supabase, userId, setThreads, fetchThreads],
  );

  const togglePin = async (e: React.MouseEvent, thread: Thread) => {
    e.preventDefault();
    e.stopPropagation();

    if (!thread.is_pinned) {
      const pinnedCount = threads.filter((t) => t.is_pinned).length;
      if (pinnedCount >= 3) {
        toast.error("You can pin up to 3 threads");
        return;
      }
    }

    // Optimistic update
    setThreads((current) => {
      const updated = current.map((t) =>
        t.id === thread.id ? { ...t, is_pinned: !t.is_pinned } : t,
      );
      // Re-sort exactly like fetchThreads does
      return updated.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return (
          new Date(b.last_updated).getTime() -
          new Date(a.last_updated).getTime()
        );
      });
    });

    const { error } = await supabase
      .from("threads")
      .update({ is_pinned: !thread.is_pinned })
      .eq("id", thread.id);

    if (error) {
      toast.error("Failed to update pin status");
      fetchThreads(); // revert on error
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Think"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDailyNote}
              className="hidden sm:inline-flex"
            >
              <UiIcon className="h-4 w-4" icon={Sparkles} /> Daily note
            </Button>
            <Button variant="primary" size="sm" onClick={handleNewThread}>
              <UiIcon className="h-4 w-4" icon={Plus} /> New thread
            </Button>
          </>
        }
      >
        <SegmentedControl
          label="Thread view"
          className="segmented-fill"
          value={view}
          onChange={(next) => {
            setShowArchive(next === "archive");
            setShowTrash(next === "trash");
          }}
          options={[
            { label: "Active", value: "active" },
            { label: "Archive", value: "archive" },
            { label: "Trash", value: "trash" },
          ]}
        />
        <div className="relative w-full md:w-64">
          <UiIcon
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--text-3)]"
            icon={Search}
          />
          <input
            type="search"
            aria-label="Search threads"
            placeholder="Search threads"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-search !w-full"
          />
        </div>
      </PageHeader>

      <ContextualTip
        id="think_space"
        title="Thoughts that stay"
        description="Keep ideas and journals in threads. Old ones resurface when they're worth another look."
      />

      {loading ? (
        <div className="py-6">
          <PageSkeleton count={4} type="card" />
        </div>
      ) : (
        <>
          {filteredThreads.filter((t) => t.stale_prompt).length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <UiIcon
                  className="h-4 w-4 text-[var(--accent)]"
                  icon={Sparkles}
                />
                <h2 className="text-label text-[var(--text-3)]">
                  Worth revisiting
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredThreads
                  .filter((t) => t.stale_prompt)
                  .map((thread, i) => (
                    <m.div
                      key={thread.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: Math.min(i, 8) * 0.03,
                        duration: 0.24,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="thread-row-wrapper"
                    >
                      <Link
                        href={`/think/${thread.id}`}
                        onClick={() => setPrefetchedThread(thread.id, thread)}
                      >
                        <GlassCard className="group relative h-full cursor-pointer border-[var(--accent-dim-hover)] bg-[var(--surface-input)] p-4 transition-colors hover:bg-[var(--surface-hover)]">
                          {/* BUG-44 — hover/focus trash affordance; stops
                                propagation so navigation doesn't fire. */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteThread(thread);
                            }}
                            aria-label={`Move ${thread.title} to trash`}
                            className="row-actions absolute top-3 right-3 hidden size-9 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-[var(--status-danger-dim)] hover:text-[var(--status-danger)] md:flex"
                          >
                            <UiIcon className="h-4 w-4" icon={Trash2} />
                          </button>
                          <div className="flex items-start gap-3">
                            <div className="w-1 shrink-0 self-stretch rounded-full bg-[var(--accent)]" />
                            <div>
                              <p className="mb-1 text-sm font-semibold text-[var(--color-text-1)]">
                                {thread.title}
                              </p>
                              <StaleResurfaceBadge
                                message={thread.stale_prompt}
                                variant="text"
                              />
                            </div>
                          </div>
                        </GlassCard>
                      </Link>
                    </m.div>
                  ))}
              </div>
            </div>
          )}

          {filteredThreads.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={Sparkles}
              title={
                showTrash
                  ? "Trash is empty"
                  : showArchive
                    ? "Nothing archived"
                    : "No threads yet"
              }
              description={
                showTrash || showArchive
                  ? "Threads you set aside will rest here."
                  : "Start with a question you keep returning to: “What if I…” or “I wonder…”."
              }
              // No second "New thread" button or trash link here: the
              // header directly above already offers both.
            />
          ) : (
            <div>
              <h2 className="text-label mt-6 mb-3 text-[var(--text-3)]">
                {showTrash
                  ? "In trash"
                  : showArchive
                    ? "Archived"
                    : "All threads"}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredThreads.map((thread, i) => (
                  <m.div
                    key={thread.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: Math.min(i, 8) * 0.03,
                      duration: 0.24,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="thread-row-wrapper"
                  >
                    <Link
                      href={`/think/${thread.id}`}
                      onClick={() => setPrefetchedThread(thread.id, thread)}
                    >
                      <GlassCard className="group relative h-full cursor-pointer p-5 transition-transform duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
                        {!showArchive && !showTrash && (
                          <>
                            {/* BUG-44 — hover/focus trash affordance; stops
                                  propagation so navigation doesn't fire. */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteThread(thread);
                              }}
                              aria-label={`Move ${thread.title} to trash`}
                              className="row-actions absolute top-3 right-12 hidden size-9 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-[var(--status-danger-dim)] hover:text-[var(--status-danger)] md:flex"
                            >
                              <UiIcon className="h-4 w-4" icon={Trash2} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => togglePin(e, thread)}
                              aria-label={
                                thread.is_pinned
                                  ? `Unpin ${thread.title}`
                                  : `Pin ${thread.title}`
                              }
                              aria-pressed={Boolean(thread.is_pinned)}
                              className={cn(
                                "absolute top-3 right-3 flex size-9 items-center justify-center rounded-lg transition-colors",
                                thread.is_pinned
                                  ? "text-[var(--accent-text)] hover:bg-[var(--surface-hover)]"
                                  : "row-actions text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
                              )}
                            >
                              <UiIcon
                                size={16}
                                strokeWidth={1.5}
                                className={cn(
                                  thread.is_pinned && "fill-current",
                                )}
                                icon={Pin}
                              />
                            </button>
                          </>
                        )}
                        <div className="flex items-start gap-3">
                          <div
                            className="w-0.5 shrink-0 self-stretch rounded-full"
                            style={{ backgroundColor: thread.color_accent }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              {!showArchive &&
                                !showTrash &&
                                thread.is_pinned && (
                                  <UiIcon
                                    className="h-3.5 w-3.5 fill-current text-[var(--accent)]"
                                    icon={Pin}
                                  />
                                )}
                              <p
                                // Element Timing: when thread titles first
                                // paint (React's types lack the attribute).
                                {...{ elementtiming: "thread-title" }}
                                className="pr-6 text-sm leading-snug font-semibold text-[var(--color-text-1)]"
                              >
                                {thread.title}
                              </p>
                            </div>
                            {thread.entries?.length > 0 && (
                              <p className="line-clamp-2 text-xs leading-relaxed text-[var(--color-text-3)]">
                                {
                                  thread.entries[thread.entries.length - 1]
                                    ?.text
                                }
                              </p>
                            )}
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-meta text-[var(--color-text-3)]">
                                {thread.entries?.length ?? 0}{" "}
                                {(thread.entries?.length ?? 0) === 1
                                  ? "entry"
                                  : "entries"}{" "}
                                · Updated {timeAgo(thread.last_updated)}
                              </span>
                              {thread.stale_prompt && (
                                <span className="text-caption flex items-center gap-1 text-[var(--accent)]">
                                  <UiIcon className="h-3 w-3" icon={Sparkles} />{" "}
                                  Revisit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    </Link>
                  </m.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
