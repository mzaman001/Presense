"use client";

import React, { useEffect, useState, useCallback, useMemo, use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskRecord } from "@/lib/task-cache";
import type { Json } from "@/types/database.types";
import { m } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Plus,
  X,
  Trash2,
  Edit2,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dropdown } from "@/components/ui/Dropdown";
import { RELATIONSHIP_COLORS } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import { moveItemToTrashPatch } from "@/lib/item-lifecycle";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface PersonNote {
  text: string;
  created_at: string;
  tag?: string;
}

interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  relationship: string;
  notes: PersonNote[];
  next_meeting: string | null;
  last_seen: string | null;
}

export default function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<number | null>(null);
  const [personToDelete, setPersonToDelete] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");

  const userSettings = useAppStore((s) => s.userSettings); // PERF-14

  // PERF-17: the person row and the linked-items query are independent —
  // the items query needs only the route `id`, so run them concurrently
  // instead of nesting the items query inside the person success branch.
  const queryKey = useMemo(() => ["person", id] as const, [id]);

  const {
    data,
    isPending: loading,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const [personRes, tasksRes] = await Promise.all([
        // maybeSingle, not single: a missing or unreachable row is a
        // "not found" view, not a thrown query.
        supabase.from("people").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("items")
          .select("*")
          .contains("linked_people_ids", [id])
          .in("status", ["active", "overdue", "inbox"])
          .limit(200),
      ]);
      if (personRes.error) throw personRes.error;
      if (tasksRes.error) throw tasksRes.error;
      return {
        person: (personRes.data as unknown as Person | null) ?? null,
        linkedTasks: (tasksRes.data ?? []) as TaskRecord[],
      };
    },
  });

  const person = data?.person ?? null;
  const linkedTasks = data?.linkedTasks ?? [];

  /** Optimistically edits the cached person row. */
  const setPerson = useCallback(
    (next: Person) => {
      queryClient.setQueryData<{
        person: Person | null;
        linkedTasks: TaskRecord[];
      }>(queryKey, (old) => (old ? { ...old, person: next } : old));
    },
    [queryClient, queryKey],
  );

  const fetchPerson = useCallback(() => {
    void refetch();
  }, [refetch]);

  const updateRelationship = async (newRel: string) => {
    if (!person) return;
    setPerson({ ...person, relationship: newRel });
    try {
      const { error } = await supabase
        .from("people")
        .update({ relationship: newRel })
        .eq("id", person.id);
      if (error) throw error;
      toast.success("Relationship updated");
    } catch (err: unknown) {
      toast.error("Failed to update", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleUpdateName = async () => {
    if (!person || !editName.trim() || editName.trim() === person.name) {
      setIsEditingName(false);
      return;
    }
    const newName = editName.trim();
    // Recompute initials just to be safe
    const newInitials = newName
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    setPerson({ ...person, name: newName, initials: newInitials });
    setIsEditingName(false);
    try {
      const { error } = await supabase
        .from("people")
        .update({ name: newName, initials: newInitials })
        .eq("id", person.id);
      if (error) throw error;
      toast.success("Name updated");
    } catch (err: unknown) {
      toast.error("Failed to update name", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      // Revert on error
      fetchPerson();
    }
  };

  useRealtime("people", fetchPerson);
  useRealtime("items", fetchPerson);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !person) return;
    setSaving(true);

    const note = { text: newNote.trim(), created_at: new Date().toISOString() };
    const updatedNotes = [...(person.notes || []), note];

    try {
      const { error } = await supabase
        .from("people")
        .update({
          notes: updatedNotes,
          last_seen: new Date().toISOString(),
        })
        .eq("id", person.id);

      if (error) throw error;

      setPerson({
        ...person,
        notes: updatedNotes,
        last_seen: new Date().toISOString(),
      });
      setNewNote("");
      toast.success("Note added");
    } catch (err: unknown) {
      toast.error("Failed to add note", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteNote = async () => {
    if (noteToDelete === null || !person || !person.notes) return;
    const updatedNotes = person.notes.filter((_, idx) => idx !== noteToDelete);
    try {
      const { error } = await supabase
        .from("people")
        .update({ notes: updatedNotes as unknown as Json[] })
        .eq("id", person.id);
      if (error) throw error;
      setPerson({ ...person, notes: updatedNotes });
      toast.success("Note removed");
    } catch (err: unknown) {
      toast.error("Failed to remove note", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setNoteToDelete(null);
    }
  };

  const handleDeletePerson = async () => {
    if (!person) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("people")
        .update(moveItemToTrashPatch())
        .eq("id", person.id);
      if (error) throw error;
      toast.success(`${person.name} moved to trash`);
      router.push("/remember/people");
    } catch (err: unknown) {
      toast.error("Failed to delete person", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setIsDeleting(false);
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

  if (!person) {
    return (
      <div className="py-20 text-center text-[var(--color-text-3)]">
        Person not found.
      </div>
    );
  }

  // Reverse notes so newest is at the top of the timeline
  const timeline = [...(person.notes || [])].reverse();
  const briefing = timeline.slice(0, 3); // top 3 for briefing

  const relKey = (person.relationship || "").toLowerCase();
  const relColor =
    person.color ||
    userSettings?.relationship_colors?.[relKey] ||
    RELATIONSHIP_COLORS[relKey] ||
    RELATIONSHIP_COLORS.other;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/remember/people"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-text-3)] transition-colors hover:text-[var(--color-text-1)]"
      >
        <UiIcon className="h-4 w-4" icon={ArrowLeft} /> Back to People
      </Link>

      <div className="flex items-center gap-4">
        <Avatar
          name={person.name}
          color={relColor}
          size="lg"
          className="h-16 w-16 text-xl"
        />
        <div className="flex-1">
          {isEditingName ? (
            <div className="mb-1 flex items-center gap-2">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                className="w-full max-w-[300px] rounded-md border border-[var(--color-border)] bg-[rgba(255,255,255,0.05)] px-2 py-1 text-[20px] font-semibold text-[var(--color-text-1)] outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={handleUpdateName}
                className="rounded-md p-1.5 text-green-500 transition-colors hover:bg-green-500/10"
              >
                <UiIcon className="h-4 w-4" icon={Check} />
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="rounded-md p-1.5 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-surface)]"
              >
                <UiIcon className="h-4 w-4" icon={X} />
              </button>
            </div>
          ) : (
            <div className="group mb-1 flex items-center gap-2">
              <h1 className="text-[26px] leading-none font-semibold tracking-tight text-[var(--color-text-1)]">
                {person.name}
              </h1>
              <button
                onClick={() => {
                  setEditName(person.name);
                  setIsEditingName(true);
                }}
                className="row-actions rounded-md p-1.5 text-[var(--color-text-3)] transition-all hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
                title="Edit name"
              >
                <UiIcon className="h-4 w-4" icon={Edit2} />
              </button>
            </div>
          )}
          <div className="mt-2">
            <Dropdown
              value={person.relationship.toLowerCase()}
              onChange={updateRelationship}
              options={(
                userSettings?.people_categories || [
                  "friend",
                  "family",
                  "professor",
                  "colleague",
                  "teammate",
                  "other",
                ]
              ).map((c: string) => ({ value: c, label: c }))}
              colors={RELATIONSHIP_COLORS}
              variant="chip"
              className="inline-block w-fit tracking-widest uppercase [&>button]:!px-2 [&>button]:!py-0.5 [&>button]:!text-sm"
            />
          </div>
        </div>
      </div>

      {briefing.length > 0 && (
        <GlassCard className="relative overflow-hidden border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.03)] p-6">
          <div className="absolute top-0 left-0 h-full w-1 bg-[#F472B6]" />
          <div className="mb-4 flex items-center gap-2">
            <UiIcon className="h-4 w-4 text-[#F472B6]" icon={Sparkles} />
            <h2 className="text-sm font-semibold tracking-widest text-[#F472B6] uppercase">
              Briefing
            </h2>
          </div>
          <ul className="space-y-3">
            {briefing.map((note, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm leading-relaxed text-[var(--color-text-1)]"
              >
                <span className="mt-0.5 text-[#F472B6]">•</span> {note.text}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {linkedTasks.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-4 text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
            Linked Tasks
          </h3>
          <div className="space-y-2">
            {linkedTasks.map((task) => (
              <GlassCard
                key={task.id}
                className="flex items-center justify-between border-[var(--color-border)] p-4"
              >
                <div>
                  <p className="text-card-title text-[var(--text-1)]">
                    {task.title}
                  </p>
                  {task.first_step && (
                    <p className="mt-1 text-xs text-[#2DD4BF]">
                      {task.first_step}
                    </p>
                  )}
                </div>
                <Link
                  href={`/do`}
                  className="rounded-lg bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                >
                  View in Do
                </Link>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      <div>
        <form onSubmit={handleAddNote} className="relative mb-6">
          <input
            placeholder={`Add a note about ${person.name}...`}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 pr-12 text-sm text-[var(--color-text-1)] transition-all outline-none placeholder:text-[var(--color-text-3)] focus:border-[#F472B6] focus:bg-[rgba(244,114,182,0.03)]"
          />
          <button
            type="submit"
            disabled={!newNote.trim() || saving}
            className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-[rgba(244,114,182,0.15)] text-[#F472B6] transition-colors hover:bg-[rgba(244,114,182,0.25)] disabled:opacity-50"
          >
            {saving ? (
              <UiIcon className="h-4 w-4 animate-spin" icon={Loader2} />
            ) : (
              <UiIcon className="h-4 w-4" icon={Plus} />
            )}
          </button>
        </form>

        <h3 className="mb-4 text-xs font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
          Timeline
        </h3>
        <div className="space-y-4">
          {timeline.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-text-3)]">
              No notes yet.
            </p>
          ) : (
            timeline.map((note, i) => {
              const originalIndex = timeline.length - 1 - i;
              return (
                <m.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <GlassCard className="group relative p-4">
                    <button
                      onClick={() => setNoteToDelete(originalIndex)}
                      className="row-actions absolute top-2 right-2 rounded-md bg-[rgba(248,113,113,0.1)] p-1.5 text-[#F87171] transition-opacity hover:bg-[rgba(248,113,113,0.2)]"
                      title="Delete note"
                    >
                      <UiIcon className="h-3.5 w-3.5" icon={X} />
                    </button>
                    <p className="mb-2 pr-6 text-sm leading-relaxed text-[var(--color-text-1)]">
                      {note.text}
                    </p>
                    <p className="text-meta text-[var(--color-text-3)]">
                      {new Date(note.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </GlassCard>
                </m.div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-12 border-t border-dashed border-[rgba(248,113,113,0.2)] pt-12">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#F87171]">
          <UiIcon className="h-4 w-4" icon={Trash2} /> Danger Zone
        </h3>
        <p className="mb-4 text-sm text-[var(--color-text-3)]">
          Deleting a person is permanent. It will remove all their notes and
          history.
        </p>
        <button
          onClick={() => setPersonToDelete(true)}
          className="text-card-title flex items-center gap-2 rounded-lg bg-[rgba(248,113,113,0.1)] px-4 py-2 text-[#F87171] transition-colors hover:bg-[rgba(248,113,113,0.2)]"
        >
          {isDeleting && (
            <UiIcon className="h-4 w-4 animate-spin" icon={Loader2} />
          )}
          Delete Person
        </button>
      </div>

      <ConfirmModal
        isOpen={noteToDelete !== null}
        onClose={() => setNoteToDelete(null)}
        onConfirm={confirmDeleteNote}
        title="Remove note?"
        description="This cannot be undone."
        confirmLabel="Remove"
        confirmDestructive
      />

      <ConfirmModal
        isOpen={personToDelete}
        onClose={() => setPersonToDelete(false)}
        onConfirm={handleDeletePerson}
        title="Delete Person"
        description="This action cannot be undone. All notes and history will be lost."
        confirmLabel="Delete"
        confirmDestructive
        inputRequired={person.name}
      />
    </div>
  );
}
