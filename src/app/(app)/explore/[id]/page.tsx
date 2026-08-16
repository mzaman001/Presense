"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { createClient, safeMutate } from "@/lib/supabase";
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  Archive,
  ExternalLink,
  X,
  Plus,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { m, AnimatePresence } from "framer-motion";
import { Icon as UiIcon } from "@/components/ui/Icon";

const PRESET_TYPES = [
  "link",
  "quote",
  "concept",
  "book",
  "movie",
  "article",
  "course",
  "podcast",
  "other",
];

export default function ExploreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  // Custom type support
  const [type, setType] = useState("other");
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // Pill component for tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  const [note, setNote] = useState("");
  const [status, setStatus] = useState("active");
  const [linkedThreadId, setLinkedThreadId] = useState<string | null>(null);

  const [threads, setThreads] = useState<{ id: string; title: string }[]>([]);
  const [isThreadDropdownOpen, setIsThreadDropdownOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // PERF-17: the item fetch (with its revisited_at mutation) and the
  // threads list are independent — the threads query needs only the
  // global active-thread list, so run them concurrently instead of
  // delaying threads behind the item round trip + mutation.
  const fetchItem = useCallback(async () => {
    const { data: item } = await supabase
      .from("explores")
      .select("*")
      .eq("id", id)
      .single();
    if (item) {
      setTitle(item.title);
      setUrl(item.url || "");

      if (item.type && PRESET_TYPES.includes(item.type)) {
        setType(item.type);
        setIsCustomType(false);
      } else {
        setType("custom");
        setIsCustomType(true);
        setCustomTypeInput(item.type || "");
      }

      setTags(item.tags || []);
      setNote(item.note || "");
      setStatus(item.status || "active");
      setLinkedThreadId(item.linked_thread_id);

      if (!item.revisited_at) {
        await safeMutate(
          () =>
            supabase
              .from("explores")
              .update({ revisited_at: new Date().toISOString() })
              .eq("id", id),
          "Failed to mark as revisited",
        );
      }
    }

    // Start in parallel: this needs nothing from the item fetch.
    const threadsPromise = supabase
      .from("threads")
      .select("id, title")
      .eq("status", "active")
      .then((res) => res.data || []);

    const threadData = await threadsPromise;
    setThreads(threadData);

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItem();
  }, [fetchItem]);

  // Close dropdowns on outside click
  useEffect(() => {
    const closeAll = () => {
      setIsTypeDropdownOpen(false);
      setIsThreadDropdownOpen(false);
    };
    document.addEventListener("click", closeAll);
    return () => document.removeEventListener("click", closeAll);
  }, []);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = newTag.trim().replace(/^#/, "");
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalType = isCustomType ? customTypeInput.trim() || "other" : type;
      const { error } = await supabase
        .from("explores")
        .update({
          title,
          url: url || null,
          type: finalType,
          note,
          tags,
          linked_thread_id: linkedThreadId || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Saved");
      router.push("/explore");
    } catch (err: unknown) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      const newStatus = status === "archived" ? "active" : "archived";
      const { error } = await supabase
        .from("explores")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      toast.success(newStatus === "archived" ? "Archived" : "Restored");
      router.push("/explore");
    } catch (err: unknown) {
      toast.error("Failed to archive", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("explores")
        .update({ status: "deleted" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Deleted (30-day trash)");
      router.push("/explore");
    } catch (err: unknown) {
      toast.error("Failed to delete", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <UiIcon
          className="h-6 w-6 animate-spin text-[var(--color-text-3)]"
          icon={Loader2}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-3)] transition-colors hover:text-[var(--color-text-1)]"
        >
          <UiIcon className="h-4 w-4" icon={ArrowLeft} /> Back to Explore
        </Link>
        <div className="flex items-center gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-[var(--color-surface)] p-2 text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
            >
              <UiIcon className="h-4 w-4" icon={ExternalLink} />
            </a>
          )}
          <button
            onClick={handleArchive}
            className="rounded-lg bg-[var(--color-surface)] p-2 text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
          >
            <UiIcon className="h-4 w-4" icon={Archive} />
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="rounded-lg bg-[rgba(248,113,113,0.1)] p-2 text-[#F87171] transition-colors hover:bg-[rgba(248,113,113,0.2)]"
          >
            <UiIcon className="h-4 w-4" icon={Trash2} />
          </button>
        </div>
      </div>

      <GlassCard className="p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-1)] transition-colors outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
              URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-1)] transition-colors outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
                Type
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTypeDropdownOpen(!isTypeDropdownOpen);
                    setIsThreadDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-1)] transition-colors hover:border-[var(--accent)]"
                >
                  <span className="capitalize">
                    {isCustomType ? customTypeInput || "Custom" : type}
                  </span>
                  <UiIcon
                    className="h-4 w-4 text-[var(--color-text-3)]"
                    icon={ChevronDown}
                  />
                </button>
                <AnimatePresence>
                  {isTypeDropdownOpen && (
                    <m.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full left-0 z-50 mt-2 flex w-full flex-col gap-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1 shadow-2xl"
                    >
                      {PRESET_TYPES.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setType(preset);
                            setIsCustomType(false);
                            setIsTypeDropdownOpen(false);
                          }}
                          className="rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] capitalize hover:bg-[rgba(255,255,255,0.08)]"
                        >
                          {preset}
                        </button>
                      ))}
                      <div className="my-1 border-t border-[var(--color-border)]" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCustomType(true);
                          setIsTypeDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--accent)] hover:bg-[rgba(255,255,255,0.08)]"
                      >
                        <UiIcon className="h-3 w-3" icon={Plus} /> Custom Type
                      </button>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>

              {isCustomType && (
                <m.input
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  autoFocus
                  placeholder="Enter custom type..."
                  value={customTypeInput}
                  onChange={(e) => setCustomTypeInput(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-[var(--accent)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-1)] transition-colors outline-none focus:border-[var(--accent)]"
                />
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 transition-colors focus-within:border-[var(--accent)]">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 rounded-md bg-[var(--accent-dim)] px-2 py-1 text-xs font-medium text-[var(--accent)]"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="transition-colors hover:text-[var(--color-text-1)]"
                    >
                      <UiIcon className="h-3 w-3" icon={X} />
                    </button>
                  </span>
                ))}
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Add tag and press Enter..."
                  className="min-w-[120px] flex-1 bg-transparent text-sm text-[var(--color-text-1)] outline-none placeholder:text-[var(--color-text-3)]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
              Link to Think Thread
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsThreadDropdownOpen(!isThreadDropdownOpen);
                  setIsTypeDropdownOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-1)] transition-colors hover:border-[var(--accent)]"
              >
                <span className="truncate pr-4">
                  {linkedThreadId
                    ? threads.find((t) => t.id === linkedThreadId)?.title ||
                      "Unknown Thread"
                    : "-- No Thread Linked --"}
                </span>
                <UiIcon
                  className="h-4 w-4 shrink-0 text-[var(--color-text-3)]"
                  icon={ChevronDown}
                />
              </button>
              <AnimatePresence>
                {isThreadDropdownOpen && (
                  <m.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="no-scrollbar absolute top-full left-0 z-50 mt-2 flex max-h-48 w-full flex-col gap-0.5 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1 shadow-2xl"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLinkedThreadId(null);
                        setIsThreadDropdownOpen(false);
                      }}
                      className="rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-3)] hover:bg-[rgba(255,255,255,0.08)]"
                    >
                      -- No Thread Linked --
                    </button>
                    {threads.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLinkedThreadId(t.id);
                          setIsThreadDropdownOpen(false);
                        }}
                        className="truncate rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] hover:bg-[rgba(255,255,255,0.08)]"
                      >
                        {t.title}
                      </button>
                    ))}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
              Notes
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--color-background)] transition-colors hover:bg-[#F59E0B] disabled:opacity-50"
          >
            {saving ? (
              <UiIcon className="h-4 w-4 animate-spin" icon={Loader2} />
            ) : (
              <UiIcon className="h-4 w-4" icon={Save} />
            )}
            Save Changes
          </button>
        </form>
      </GlassCard>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Explore"
        description="Are you sure you want to delete this? It will be permanently removed in 30 days."
        confirmLabel="Delete"
        confirmDestructive
        onConfirm={handleDelete}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
