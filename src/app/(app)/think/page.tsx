"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { m } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, Loader2, Sparkles, Pin, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { useAppStore } from "@/store/useAppStore";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LenisProvider } from "@/components/layout/LenisProvider";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface Thread {
  id: string;
  title: string;
  color_accent: string;
  entries: Array<{ text: string; created_at: string; starred?: boolean }>;
  stale_prompt: string | null;
  last_updated: string;
  status: string;
  is_pinned: boolean;
}

export default function ThinkPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const setPrefetchedThread = useAppStore((s) => s.setPrefetchedThread);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = threads.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.entries &&
        t.entries.some((e) =>
          e.text.toLowerCase().includes(searchQuery.toLowerCase()),
        )),
  );

  const fetchThreads = useCallback(async () => {
    let query = supabase
      .from("threads")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("last_updated", { ascending: false });

    if (showTrash) query = query.eq("status", "deleted");
    else if (showArchive) query = query.eq("status", "archived");
    else query = query.eq("status", "active");

    const { data } = await query;
    setThreads((data as unknown as Thread[]) ?? []);
    setLoading(false);
  }, [supabase, showArchive, showTrash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchThreads();
  }, [fetchThreads]);

  useRealtime("threads", fetchThreads);

  const timeAgo = (dt: string) => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(dt).getTime();
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Try insert first — the unique index on (user_id, title) prevents duplicates.
    // If a race condition causes a conflict, fall back to fetching the existing thread.
    const { data: inserted } = await supabase
      .from("threads")
      .insert({
        user_id: user.id,
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
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (existingThreads && existingThreads.length > 0) {
      router.push(`/think/${existingThreads[0].id}`);
    }
  };

  const handleNewThread = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("threads")
      .insert({
        user_id: user.id,
        title: "Untitled Thread",
        color_accent: "#E5B41E",
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
    <LenisProvider>
      <div className="space-y-6">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-caption mb-1 font-semibold tracking-widest text-[rgba(255,255,255,0.35)] uppercase">
              Space
            </p>
            <div className="flex items-center gap-4">
              <h1 className="text-[22px] font-medium tracking-tight text-[var(--color-text-1)]">
                Think
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowArchive(false);
                    setShowTrash(false);
                    setThreads([]);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    !showArchive && !showTrash
                      ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] text-[var(--color-background)]"
                      : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]",
                  )}
                >
                  Active
                </button>
                <button
                  onClick={() => {
                    setShowArchive(true);
                    setShowTrash(false);
                    setThreads([]);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    showArchive
                      ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] text-[var(--color-background)]"
                      : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]",
                  )}
                >
                  Archive
                </button>
                <button
                  onClick={() => {
                    setShowTrash(true);
                    setShowArchive(false);
                    setThreads([]);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    showTrash
                      ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] text-[var(--color-background)]"
                      : "border-[var(--color-border)] text-[var(--color-text-3)] hover:bg-[var(--color-surface)]",
                  )}
                >
                  Trash
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <UiIcon
                size={13}
                strokeWidth={1.5}
                className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--text-3)]"
                icon={Search}
              />
              <input
                type="text"
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-search hidden !w-48 md:block"
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleDailyNote}
              className="hidden !border-[rgba(251,191,36,0.25)] !bg-[rgba(251,191,36,0.12)] !text-[#FBBF24] hover:!bg-[rgba(251,191,36,0.2)] sm:flex"
            >
              <UiIcon className="h-4 w-4" icon={Sparkles} /> Daily Note
            </Button>
            <Button
              variant="secondary"
              onClick={handleNewThread}
              className="!border-[var(--accent-border)] !bg-[var(--accent-dim)] !text-[var(--accent)] hover:!bg-[var(--accent-dim-hover)]"
            >
              <UiIcon className="h-4 w-4" icon={Plus} /> New thread
            </Button>
          </div>
        </div>

        <ContextualTip
          id="think_space"
          title="Thoughts that stay"
          description="This is the Think space. Create threads for ideas, journals, or long-term thoughts. We will resurface old threads to prompt new insights."
        />

        <div className="md:hidden">
          <div className="relative">
            <UiIcon
              size={13}
              strokeWidth={1.5}
              className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--text-3)]"
              icon={Search}
            />
            <input
              type="text"
              placeholder="Search threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-search w-full md:hidden"
            />
          </div>
        </div>

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
                  <h2 className="text-sm font-semibold text-[var(--color-text-1)]">
                    Stale Threads
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
                        transition={{ delay: i * 0.05 }}
                        className="thread-row-wrapper"
                      >
                        <Link
                          href={`/think/${thread.id}`}
                          onClick={() => setPrefetchedThread(thread.id, thread)}
                        >
                          <GlassCard className="h-full cursor-pointer border-[var(--accent-dim-hover)] bg-[var(--surface-input)] p-4 transition-colors hover:bg-[var(--surface-hover)]">
                            <div className="flex items-start gap-3">
                              <div className="w-1 shrink-0 self-stretch rounded-full bg-[var(--accent)]" />
                              <div>
                                <p className="mb-1 text-sm font-semibold text-[var(--color-text-1)]">
                                  {thread.title}
                                </p>
                                <p className="text-xs leading-relaxed font-medium text-[var(--accent)]">
                                  {thread.stale_prompt}
                                </p>
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
              <GlassCard className="mt-6 flex flex-col items-center justify-center border-dashed border-[rgba(255,255,255,0.08)] p-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.03)]">
                  <UiIcon
                    className="h-6 w-6 text-[var(--color-text-3)]"
                    icon={Sparkles}
                  />
                </div>
                <h3 className="mb-2 font-medium text-[var(--color-text-1)]">
                  No threads yet
                </h3>
                <p className="mb-6 max-w-sm text-sm text-[var(--color-text-3)]">
                  Capture a thought — &ldquo;What if I...&rdquo; or &ldquo;I
                  wonder...&rdquo; to start expanding your ideas.
                </p>
                <Button
                  variant="primary"
                  onClick={handleNewThread}
                  className="gap-2"
                >
                  <UiIcon size={16} icon={Plus} /> New Thought
                </Button>
              </GlassCard>
            ) : (
              <div>
                <h2 className="mt-6 mb-3 text-sm font-semibold text-[var(--color-text-1)]">
                  All Threads
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredThreads.map((thread, i) => (
                    <m.div
                      key={thread.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="thread-row-wrapper"
                    >
                      <Link
                        href={`/think/${thread.id}`}
                        onClick={() => setPrefetchedThread(thread.id, thread)}
                      >
                        <GlassCard className="group relative h-full cursor-pointer p-5 transition-transform hover:scale-[1.01]">
                          {!showArchive && !showTrash && (
                            <button
                              onClick={(e) => togglePin(e, thread)}
                              className={cn(
                                "absolute top-3 right-3 rounded-lg p-1.5 transition-all",
                                thread.is_pinned
                                  ? "text-[var(--accent)] opacity-100 hover:bg-[var(--surface-hover)]"
                                  : "text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface)] hover:text-[var(--text-2)]",
                              )}
                            >
                              <UiIcon
                                size={14}
                                strokeWidth={1.5}
                                className={cn(
                                  thread.is_pinned && "fill-current",
                                )}
                                icon={Pin}
                              />
                            </button>
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
                                <p className="pr-6 text-sm leading-snug font-semibold text-[var(--color-text-1)]">
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
                                  {thread.entries?.length ?? 0} entries ·
                                  Updated {timeAgo(thread.last_updated)}
                                </span>
                                {thread.stale_prompt && (
                                  <span className="text-caption flex items-center gap-1 text-[var(--accent)]">
                                    <UiIcon
                                      className="h-3 w-3"
                                      icon={Sparkles}
                                    />{" "}
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
    </LenisProvider>
  );
}
