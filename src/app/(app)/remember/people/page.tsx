"use client";
import { EmptyState } from "@/components/ui/EmptyState";

import React, { useEffect, useState, useCallback } from "react";
import { m, useMotionValue, useTransform, animate } from "framer-motion";
import { createClient, safeMutate } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { AddPersonPanel } from "@/components/features/AddPersonPanel";
import {
  Plus,
  Clock,
  ChevronRight,
  GripVertical,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RELATIONSHIP_COLORS } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import { moveItemToTrashPatch, restoreItemPatch } from "@/lib/item-lifecycle";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  relationship: string;
  notes: Array<{ text: string; created_at: string; tag?: string }>;
  last_seen: string | null;
  next_meeting: string | null;
  sort_order: number;
}

const TodayPersonCard = ({
  person,
  formatMeeting,
  deletePerson,
}: {
  person: Person;
  formatMeeting: (d: string) => string;
  deletePerson: (person: Person) => void;
}) => {
  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [0, -80], [0, 1]);
  const deleteScale = useTransform(dragX, [0, -80], [0.7, 1]);

  /* @todo: Untyped usage justified per TOOL-01 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragEnd = async (_: any, info: any) => {
    if (info.offset.x < -80) {
      animate(dragX, -300, { duration: 0.2 });
      deletePerson(person);
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  const relKey = (person.relationship || "").toLowerCase();
  const relColor =
    person.color ||
    useAppStore.getState().userSettings?.relationship_colors?.[relKey] ||
    RELATIONSHIP_COLORS[relKey] ||
    RELATIONSHIP_COLORS.other;

  return (
    <m.div
      layout
      layoutId={person.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group animate-in fade-in relative overflow-hidden rounded-2xl"
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

      {/* Draggable card */}
      <m.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="relative"
      >
        <Link href={`/remember/people/${person.id}`}>
          <GlassCard className="cursor-pointer !rounded-2xl p-5 transition-all duration-200 ease-out hover:-translate-y-px hover:scale-[1.01] hover:border-[var(--accent-border)]">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={person.name} color={relColor} />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-1)]">
                    {person.name}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-[var(--accent)]">
                    <UiIcon className="h-3 w-3" icon={Clock} /> Meeting at{" "}
                    {formatMeeting(person.next_meeting!)}
                  </p>
                </div>
              </div>
              <span className="text-caption rounded-full border border-[var(--accent-border)] bg-[var(--accent-dim)] px-2 py-1 font-bold tracking-widest text-[var(--accent)] uppercase">
                Briefing Ready
              </span>
            </div>
            {person.notes
              ?.slice(-3)
              .reverse()
              .map((note, ni) => (
                <p
                  key={ni}
                  className="mt-1 flex items-start gap-1.5 text-xs text-[var(--color-text-3)]"
                >
                  <UiIcon
                    className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]"
                    icon={ChevronRight}
                  />{" "}
                  {note.text}
                </p>
              ))}
          </GlassCard>
        </Link>
      </m.div>
    </m.div>
  );
};

function SortablePersonRow({
  person,
  formatMeeting,
  deletePerson,
}: {
  person: Person;
  formatMeeting: (d: string) => string;
  deletePerson: (person: Person) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: person.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: "relative" as const,
  };

  const userSettings = useAppStore((s) => s.userSettings); // PERF-14
  const relKey = (person.relationship || "").toLowerCase();
  const relColor =
    person.color ||
    userSettings?.relationship_colors?.[relKey] ||
    RELATIONSHIP_COLORS[relKey] ||
    RELATIONSHIP_COLORS.other;

  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [0, -80], [0, 1]);
  const deleteScale = useTransform(dragX, [0, -80], [0.7, 1]);

  /* @todo: Untyped usage justified per TOOL-01 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragEnd = async (_: any, info: any) => {
    if (info.offset.x < -80) {
      animate(dragX, -300, { duration: 0.2 });
      deletePerson(person);
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        isDragging && "z-50 opacity-50",
        "group relative overflow-hidden rounded-2xl",
      )}
    >
      {/* Swipe-to-delete reveal layer */}
      <m.div
        className="absolute inset-y-0 right-0 left-8 flex items-center justify-end overflow-hidden rounded-r-2xl pr-5"
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

      {/* Draggable card container */}
      <m.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="relative z-10"
      >
        <GlassCard className="flex items-stretch overflow-hidden !rounded-2xl bg-[var(--color-surface)] p-0 transition-all duration-200 ease-out group-hover:border-[var(--accent-border)] hover:-translate-y-px hover:scale-[1.005]">
          <div
            {...attributes}
            {...listeners}
            className="flex w-10 shrink-0 cursor-grab items-center justify-center border-r border-[var(--color-border)] transition-colors hover:bg-[rgba(255,255,255,0.03)] active:cursor-grabbing"
          >
            <UiIcon
              className="h-4 w-4 text-[var(--color-text-3)]"
              icon={GripVertical}
            />
          </div>

          <Link
            href={`/remember/people/${person.id}`}
            className="block min-w-0 flex-1 p-4 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
          >
            <div className="flex items-center gap-3">
              <Avatar name={person.name} color={relColor} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-card-title text-[var(--text-1)]">
                  {person.name}
                </p>
                {person.notes?.length > 0 && (
                  <p className="text-meta truncate text-[var(--color-text-3)]">
                    {person.notes[person.notes.length - 1]?.text}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <p
                  className="text-caption bg-opacity-10 rounded-full border px-2 py-0.5 font-bold tracking-widest uppercase"
                  style={{
                    color: relColor,
                    borderColor: `${relColor}40`,
                    backgroundColor: `${relColor}15`,
                  }}
                >
                  {person.relationship}
                </p>
                {person.next_meeting && (
                  <p className="text-caption text-[var(--color-text-3)]">
                    {formatMeeting(person.next_meeting)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </GlassCard>
      </m.div>
    </div>
  );
}

export default function PeoplePage() {
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchPeople = useCallback(async () => {
    // INFRA-18: explicit user_id filter for planner index usage.
    const { data: userSession } = await supabase.auth.getUser();
    if (!userSession?.user) return;
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("user_id", userSession.user.id)
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) {
      setFetchError(error.message);
    }
    setPeople((data as unknown as Person[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPeople();
  }, [fetchPeople]);

  useRealtime("people", fetchPeople);

  const now = new Date();
  const today = people.filter(
    (p) =>
      p.next_meeting &&
      new Date(p.next_meeting).toDateString() === now.toDateString(),
  );
  const others = people.filter(
    (p) =>
      !p.next_meeting ||
      new Date(p.next_meeting).toDateString() !== now.toDateString(),
  );

  const formatMeeting = (dt: string) => {
    const d = new Date(dt);
    return (
      d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      " at " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
  };

  const deletePerson = async (person: Person) => {
    setPeople((prev) => prev.filter((p) => p.id !== person.id));

    try {
      const { error } = await supabase
        .from("people")
        .update(moveItemToTrashPatch())
        .eq("id", person.id);
      if (error) throw error;

      toast.success("Person moved to trash", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                const { success } = await safeMutate(
                  () =>
                    supabase
                      .from("people")
                      .update(restoreItemPatch("active"))
                      .eq("id", person.id),
                  "Failed to restore person",
                );
                if (success) fetchPeople();
              }
            } catch {
              toast.error("Failed to restore person");
              fetchPeople();
            }
          },
        },
      });
    } catch {
      toast.error("Failed to delete person");
      fetchPeople();
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPeople((items) => {
        const oldIndex = items.findIndex((x) => x.id === active.id);
        const newIndex = items.findIndex((x) => x.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        const updated = newItems.map((item, index) => ({
          ...item,
          sort_order: index,
        }));

        const payload = updated.map((u) => ({
          id: u.id,
          sort_order: u.sort_order,
        }));
        fetch("/api/people/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload }),
        }).catch((err) => console.error("Failed to reorder:", err));

        return updated;
      });
    }
  };

  return (
    <div>
      {loading ? (
        <div className="py-6">
          <PageSkeleton count={5} type="person" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Today's meetings */}
          {today.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[var(--color-text-1)]">
                    Today&apos;s Briefings
                  </h2>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)] shadow-[var(--shadow-accent-glow)]" />
                </div>
                <button
                  onClick={() => setIsPanelOpen(true)}
                  className="text-card-title flex items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-dim)] px-4 py-2 text-[var(--accent)] transition-colors hover:bg-[var(--accent-dim-hover)]"
                >
                  <UiIcon className="h-4 w-4" icon={Plus} /> Add person
                </button>
              </div>
              <div className="space-y-3">
                {today.map((person) => (
                  <TodayPersonCard
                    key={person.id}
                    person={person}
                    formatMeeting={formatMeeting}
                    deletePerson={deletePerson}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All contacts with DND */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="inline text-sm font-semibold text-[var(--color-text-1)]">
                  All Contacts
                </h2>
                <span className="ml-2 text-xs font-normal text-[var(--color-text-3)]">
                  {others.length} people
                </span>
              </div>
              {today.length === 0 && (
                <button
                  onClick={() => setIsPanelOpen(true)}
                  className="text-card-title flex items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-dim)] px-4 py-2 text-[var(--accent)] transition-colors hover:bg-[var(--accent-dim-hover)]"
                >
                  <UiIcon className="h-4 w-4" icon={Plus} /> Add person
                </button>
              )}
            </div>
            {others.length === 0 && today.length === 0 ? (
              fetchError ? (
                <GlassCard className="flex flex-col items-center justify-center border-dashed border-[var(--border-default)] p-12 text-center">
                  <p className="text-sm text-red-400">
                    Error loading people: {fetchError}
                  </p>
                </GlassCard>
              ) : (
                <EmptyState
                  icon={Users}
                  title="Your network is empty"
                  description="Add someone manually, or capture &ldquo;Meeting with Alex&rdquo; to automatically create a profile."
                  action={
                    <Button
                      variant="primary"
                      onClick={() => setIsPanelOpen(true)}
                      className="mx-auto gap-2"
                    >
                      <UiIcon size={16} icon={Plus} /> Add Person
                    </Button>
                  }
                />
              )
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={others.map((o) => o.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {others.map((person) => (
                      <SortablePersonRow
                        key={person.id}
                        person={person}
                        formatMeeting={formatMeeting}
                        deletePerson={deletePerson}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}

      <AddPersonPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onPersonAdded={fetchPeople}
      />
    </div>
  );
}
