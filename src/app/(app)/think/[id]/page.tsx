"use client";
import { logger } from "@/lib/logger";

import React, { useEffect, useState, useCallback, use } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { m, AnimatePresence } from "framer-motion";
import { createClient, safeMutate } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  ArrowLeft,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Archive,
  Pin,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { cn, extractMentions } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Kbd } from "@/components/ui/Kbd";
import { useAppStore } from "@/store/useAppStore";
import { moveItemToTrashPatch } from "@/lib/item-lifecycle";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface ThreadEntry {
  text: string;
  created_at: string;
  starred?: boolean;
}

interface Thread {
  id: string;
  title: string;
  color_accent: string;
  entries: ThreadEntry[];
  stale_prompt: string | null;
  status: string;
  is_pinned: boolean;
}

export default function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const prefetchedThreads = useAppStore((s) => s.prefetchedThreads);
  const prefetched = prefetchedThreads[id] as Thread | undefined;
  const [thread, setThread] = useState<Thread | null>(prefetched || null);
  const [loading, setLoading] = useState(!prefetched);
  const [newEntry, setNewEntry] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkedExplores, setLinkedExplores] = useState<
    { id: string; title: string; type: string | null }[]
  >([]);

  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverSearch, setPopoverSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchPeople() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("people")
        .select("id, name")
        .eq("user_id", user.id);
      if (data && Array.isArray(data)) {
        setPeople(data);
      }
    }
    fetchPeople();
  }, [supabase]);

  const filteredPeople = React.useMemo(() => {
    return people.filter((p) =>
      p.name.toLowerCase().includes(popoverSearch.toLowerCase()),
    );
  }, [people, popoverSearch]);

  const handleSelectPerson = useCallback(
    (person: { id: string; name: string }) => {
      if (!textareaRef.current) return;
      const val = newEntry;
      const selectionStart = textareaRef.current.selectionStart || 0;
      const textBeforeCursor = val.slice(0, selectionStart);
      const textAfterCursor = val.slice(selectionStart);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      const mentionText = `@[${person.name}](${person.id})`;
      const newVal =
        val.slice(0, lastAtIndex) + mentionText + " " + textAfterCursor;
      setNewEntry(newVal);
      setShowPopover(false);

      // Focus textarea and move cursor
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const cursorPosition = lastAtIndex + mentionText.length + 1;
          textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    },
    [newEntry],
  );

  const handleInputChange = (val: string) => {
    setNewEntry(val);

    if (!textareaRef.current) return;
    const selectionStart = textareaRef.current.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (
      lastAtIndex !== -1 &&
      (lastAtIndex === 0 ||
        textBeforeCursor[lastAtIndex - 1] === " " ||
        textBeforeCursor[lastAtIndex - 1] === "\n")
    ) {
      const search = textBeforeCursor.slice(lastAtIndex + 1);
      if (!search.includes(" ") && !search.includes("\n")) {
        setShowPopover(true);
        setPopoverSearch(search);
        setSelectedIndex(0);
        return;
      }
    }
    setShowPopover(false);
  };

  const getLinkedPeople = (entriesList: ThreadEntry[]) => {
    const allMentions = entriesList.flatMap((e) =>
      extractMentions(e.text || ""),
    );
    return Array.from(new Set(allMentions));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPopover && filteredPeople.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredPeople.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredPeople.length) % filteredPeople.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectPerson(filteredPeople[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowPopover(false);
      }
    } else {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleAddEntry(e);
      }
    }
  };

  const [deleteThreadOpen, setDeleteThreadOpen] = useState(false);
  const [deleteEntryIndex, setDeleteEntryIndex] = useState<number | null>(null);

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target as Node)
      ) {
        setIsColorPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchThread = useCallback(async () => {
    const { data: threadData } = await supabase
      .from("threads")
      .select("*")
      .eq("id", id)
      .single();
    setThread(threadData as unknown as Thread);

    const { data: exploresData } = await supabase
      .from("explores")
      .select("id, title, type")
      .eq("linked_thread_id", id)
      .in("status", ["active", "archived"]);
    setLinkedExplores(exploresData || []);

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchThread();
  }, [fetchThread]);
  useRealtime("threads", fetchThread);
  useRealtime("explores", fetchThread);

  const handleTogglePin = async () => {
    if (!thread) return;
    try {
      const newPinStatus = !thread.is_pinned;
      const { error } = await supabase
        .from("threads")
        .update({ is_pinned: newPinStatus })
        .eq("id", thread.id);
      if (error) throw error;
      setThread({ ...thread, is_pinned: newPinStatus });
      toast.success(newPinStatus ? "Thread pinned" : "Thread unpinned");
    } catch (error: unknown) {
      toast.error("Failed to pin thread", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleColorChange = async (color: string) => {
    if (!thread) return;
    setIsColorPickerOpen(false);
    try {
      const { error } = await supabase
        .from("threads")
        .update({ color_accent: color })
        .eq("id", thread.id);
      if (error) throw error;
      setThread({ ...thread, color_accent: color });
      toast.success("Color updated");
    } catch (error: unknown) {
      toast.error("Failed to update color", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleArchive = async () => {
    if (!thread) return;
    try {
      const newStatus =
        thread.status === "archived" || thread.status === "deleted"
          ? "active"
          : "archived";
      const { error } = await supabase
        .from("threads")
        .update({ status: newStatus })
        .eq("id", thread.id);
      if (error) throw error;
      toast.success(
        newStatus === "active" ? "Thread restored" : "Thread archived",
      );
      router.push("/think");
    } catch (error: unknown) {
      toast.error("Failed to update thread status", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDelete = async () => {
    if (!thread) return;
    try {
      const { error } = await supabase
        .from("threads")
        .update(moveItemToTrashPatch())
        .eq("id", id);
      if (error) throw error;
      toast.success("Moved to trash");
      router.push("/think");
    } catch (err: unknown) {
      toast.error("Failed to delete", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleteThreadOpen(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim() || !thread) return;
    setSaving(true);

    try {
      const entry = {
        text: newEntry.trim(),
        created_at: new Date().toISOString(),
      };
      const updatedEntries = [...(thread.entries || []), entry];
      const linkedPeople = getLinkedPeople(updatedEntries);

      const { error } = await supabase
        .from("threads")
        .update({
          entries: updatedEntries,
          last_updated: new Date().toISOString(),
          stale_prompt: null, // Clear stale prompt if they revisit
          linked_people_ids: linkedPeople,
        })
        .eq("id", thread.id);

      if (error) throw error;

      setThread({ ...thread, entries: updatedEntries, stale_prompt: null });
      setNewEntry("");
      toast.success("Added to thread");
    } catch (error: unknown) {
      logger.error("Think error:", error);
      toast.error("Failed to save thought", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
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

  if (!thread) {
    return (
      <div className="py-20 text-center text-[var(--color-text-3)]">
        Thread not found.
      </div>
    );
  }

  const handleDeleteEntry = async () => {
    if (!thread || deleteEntryIndex === null) return;
    try {
      const updatedEntries = thread.entries.filter(
        (_, i) => i !== deleteEntryIndex,
      );
      const linkedPeople = getLinkedPeople(updatedEntries);
      const { error } = await supabase
        .from("threads")
        .update({
          /* @todo: Untyped usage justified per TOOL-01 */
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entries: updatedEntries as any,
          linked_people_ids: linkedPeople,
        })
        .eq("id", thread.id);
      if (error) throw error;
      setThread({ ...thread, entries: updatedEntries });
      toast.success("Entry deleted");
    } catch (err: unknown) {
      toast.error("Failed to delete entry", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleteEntryIndex(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-32">
      <Link
        href="/think"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-text-3)] transition-colors hover:text-[var(--color-text-1)]"
      >
        <UiIcon className="h-4 w-4" icon={ArrowLeft} /> Back to Think
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="relative pt-1" ref={colorPickerRef}>
            <button
              type="button"
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              className="h-10 w-1.5 shrink-0 cursor-pointer rounded-full focus:outline-none"
              style={{ backgroundColor: thread.color_accent }}
              title="Change thread accent color"
            />
            {isColorPickerOpen && (
              <div className="absolute top-full left-0 z-50 pt-2">
                <div className="flex gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-2 shadow-xl">
                  {[
                    "#FBBF24",
                    "#F472B6",
                    "#2DD4BF",
                    "#A78BFA",
                    "#60A5FA",
                    "#F87171",
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleColorChange(c)}
                      className="h-4 w-4 rounded-full border border-[var(--color-border)] transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <input
              value={thread.title}
              onChange={(e) => setThread({ ...thread, title: e.target.value })}
              onBlur={async (e) => {
                const newTitle = e.target.value.trim();
                if (newTitle !== "") {
                  const { success } = await safeMutate(
                    () =>
                      supabase
                        .from("threads")
                        .update({ title: newTitle })
                        .eq("id", thread.id),
                    "Failed to rename thread",
                  );
                  if (!success) return;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="-ml-2 w-full rounded-lg border-none bg-transparent px-2 py-1 text-[26px] leading-snug font-semibold tracking-tight text-[var(--color-text-1)] transition-colors outline-none placeholder:text-[var(--color-text-3)] hover:bg-[rgba(255,255,255,0.05)] focus:bg-[rgba(255,255,255,0.05)]"
              placeholder="Thread Title"
            />
            {thread.stale_prompt && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[rgba(45,212,191,0.2)] bg-[rgba(45,212,191,0.1)] px-3 py-1">
                <UiIcon
                  className="h-3.5 w-3.5 text-[#2DD4BF]"
                  icon={Sparkles}
                />
                <span className="text-xs font-medium text-[#2DD4BF]">
                  {thread.stale_prompt}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePin}
            className={cn(
              "rounded-lg p-2 transition-colors",
              thread.is_pinned
                ? "bg-[rgba(45,212,191,0.1)] text-[#2DD4BF]"
                : "text-[var(--color-text-3)] hover:bg-[var(--color-surface)]",
            )}
            title={thread.is_pinned ? "Unpin thread" : "Pin thread"}
          >
            <UiIcon className="h-4 w-4" icon={Pin} />
          </button>
          <button
            onClick={handleArchive}
            className="rounded-lg p-2 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-surface)]"
            title={
              thread.status === "archived" || thread.status === "deleted"
                ? "Restore thread"
                : "Archive thread"
            }
          >
            {thread.status === "archived" || thread.status === "deleted" ? (
              <UiIcon className="h-4 w-4" icon={RefreshCcw} />
            ) : (
              <UiIcon className="h-4 w-4" icon={Archive} />
            )}
          </button>
          <button
            onClick={() => setDeleteThreadOpen(true)}
            className="rounded-lg p-2 text-[var(--color-text-3)] transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#F87171]"
            title={
              thread.status === "deleted"
                ? "Delete permanently"
                : "Move to trash"
            }
          >
            <UiIcon className="h-4 w-4" icon={Trash2} />
          </button>
        </div>
      </div>

      {linkedExplores.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
            Linked Resources
          </h3>
          <div className="flex flex-wrap gap-3">
            {linkedExplores.map((item) => (
              <Link key={item.id} href={`/explore/${item.id}`}>
                <GlassCard className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[var(--color-surface)]">
                  <div className="h-2 w-2 rounded-full bg-[#FBBF24]" />
                  <span className="text-sm font-medium text-[var(--color-text-1)]">
                    {item.title}
                  </span>
                  <span className="text-caption ml-2 text-[var(--color-text-3)] uppercase">
                    {item.type}
                  </span>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {(thread.entries || []).map((entry, i) => (
            <m.div
              key={`${entry.created_at}-${i}`}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <GlassCard className="group relative border-l-2 border-l-transparent p-5 transition-all hover:border-l-[#2DD4BF]">
                <p className="text-title-sm pr-8 leading-relaxed whitespace-pre-wrap text-[var(--color-text-1)]">
                  {entry.text}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-meta text-[var(--color-text-3)]">
                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteEntryIndex(i)}
                  className="absolute top-4 right-4 rounded p-1.5 text-[var(--color-text-3)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[rgba(248,113,113,0.1)] hover:text-[#F87171]"
                  title="Delete entry"
                >
                  <UiIcon className="h-4 w-4" icon={Trash2} />
                </button>
              </GlassCard>
            </m.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Fixed bottom input for thoughts */}
      <div className="fixed right-0 bottom-0 left-0 z-40 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/90 to-transparent p-4 md:pl-[220px]">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleAddEntry} className="relative">
            {showPopover && filteredPeople.length > 0 && (
              <div
                className="absolute right-0 bottom-full left-0 z-50 mb-2 max-h-60 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
                data-testid="mentions-popover"
              >
                {filteredPeople.map((person, idx) => (
                  <button
                    key={person.id}
                    onClick={() => handleSelectPerson(person)}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm text-[var(--color-text-1)] hover:bg-[rgba(255,255,255,0.05)] focus:outline-none",
                      idx === selectedIndex && "bg-[rgba(255,255,255,0.08)]",
                    )}
                    type="button"
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            )}
            <TextareaAutosize
              ref={textareaRef}
              placeholder="Continue the thought..."
              value={newEntry}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              minRows={1}
              maxRows={10}
              className="input resize-none !rounded-2xl !py-4 !pr-14"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <Kbd className="hidden border-none bg-transparent text-[var(--color-text-3)] md:inline-flex">
                Cmd+Enter
              </Kbd>
              <button
                type="submit"
                disabled={!newEntry.trim() || saving}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(45,212,191,0.15)] text-[#2DD4BF] transition-colors hover:bg-[rgba(45,212,191,0.25)] disabled:opacity-50"
              >
                {saving ? (
                  <UiIcon className="h-4 w-4 animate-spin" icon={Loader2} />
                ) : (
                  <UiIcon className="ml-0.5 h-4 w-4" icon={Send} />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <ConfirmModal
        isOpen={deleteThreadOpen}
        onClose={() => setDeleteThreadOpen(false)}
        onConfirm={handleDelete}
        title={
          thread.status === "deleted" ? "Delete permanently?" : "Move to Trash?"
        }
        description={
          thread.status === "deleted"
            ? "This action cannot be undone."
            : "This thread will be moved to the trash and permanently deleted after 30 days."
        }
        confirmLabel={
          thread.status === "deleted" ? "Delete permanently" : "Move to Trash"
        }
        confirmDestructive
      />

      <ConfirmModal
        isOpen={deleteEntryIndex !== null}
        onClose={() => setDeleteEntryIndex(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Entry?"
        description="Are you sure you want to delete this thought? This action cannot be undone."
        confirmDestructive
        confirmLabel="Delete"
      />
    </div>
  );
}
