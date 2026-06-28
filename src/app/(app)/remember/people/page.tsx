"use client";
import React, { useEffect, useState, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { AddPersonPanel } from "@/components/features/AddPersonPanel";
import { Plus, Loader2, Clock, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { toast } from "sonner";
import { RELATIONSHIP_COLORS } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  deletePerson 
}: { 
  person: Person; 
  formatMeeting: (d: string) => string; 
  deletePerson: (person: Person) => void;
}) => {
  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [0, -80], [0, 1]);
  const deleteScale = useTransform(dragX, [0, -80], [0.7, 1]);

  const handleDragEnd = async (_: any, info: any) => {
    if (info.offset.x < -80) {
      animate(dragX, -300, { duration: 0.2 });
      deletePerson(person);
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  const relKey = (person.relationship || '').toLowerCase();
  const relColor = person.color || useAppStore.getState().userSettings?.relationship_colors?.[relKey] || RELATIONSHIP_COLORS[relKey] || RELATIONSHIP_COLORS.other;

  return (
    <motion.div
      layout
      layoutId={person.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative rounded-2xl overflow-hidden animate-in fade-in"
    >
      {/* Swipe-to-delete reveal layer */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
          opacity: deleteOpacity,
        }}
      >
        <motion.div style={{ scale: deleteScale }}>
          <Trash2 className="w-5 h-5 text-red-400" />
        </motion.div>
      </motion.div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="relative"
      >
        <Link href={`/remember/people/${person.id}`}>
          <GlassCard className="p-5 hover:scale-[1.01] hover:-translate-y-px transition-all duration-200 ease-out cursor-pointer hover:border-[var(--accent-border)] !rounded-2xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar name={person.name} color={relColor} />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-1)]">{person.name}</p>
                  <p className="text-xs text-[var(--accent)] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Meeting at {formatMeeting(person.next_meeting!)}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent-border)] px-2 py-1 rounded-full">Briefing Ready</span>
            </div>
            {person.notes?.slice(-3).reverse().map((note, ni) => (
              <p key={ni} className="text-xs text-[var(--color-text-3)] flex items-start gap-1.5 mt-1">
                <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-[var(--accent)]" /> {note.text}
              </p>
            ))}
          </GlassCard>
        </Link>
      </motion.div>
    </motion.div>
  );
};

function SortablePersonRow({ 
  person, 
  formatMeeting, 
  deletePerson 
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
    position: 'relative' as const,
  };

  const { userSettings } = useAppStore();
  const relKey = (person.relationship || '').toLowerCase();
  const relColor = person.color || userSettings?.relationship_colors?.[relKey] || RELATIONSHIP_COLORS[relKey] || RELATIONSHIP_COLORS.other;

  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [0, -80], [0, 1]);
  const deleteScale = useTransform(dragX, [0, -80], [0.7, 1]);

  const handleDragEnd = async (_: any, info: any) => {
    if (info.offset.x < -80) {
      animate(dragX, -300, { duration: 0.2 });
      deletePerson(person);
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50 z-50", "group relative rounded-2xl overflow-hidden")}>
      {/* Swipe-to-delete reveal layer */}
      <motion.div
        className="absolute inset-y-0 right-0 left-8 flex items-center justify-end pr-5 rounded-r-2xl overflow-hidden"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
          opacity: deleteOpacity,
        }}
      >
        <motion.div style={{ scale: deleteScale }}>
          <Trash2 className="w-5 h-5 text-red-400" />
        </motion.div>
      </motion.div>

      {/* Draggable card container */}
      <GlassCard className="p-0 hover:scale-[1.005] transition-transform overflow-hidden flex items-stretch !rounded-2xl">
        <div 
          {...attributes} 
          {...listeners} 
          className="w-8 flex items-center justify-center bg-[var(--color-surface)] border-r border-[var(--color-border)] cursor-grab active:cursor-grabbing hover:bg-[var(--color-surface)] transition-colors shrink-0"
        >
          <GripVertical className="w-4 h-4 text-[var(--color-text-3)]" />
        </div>
        
        {/* Draggable inner wrapper */}
        <motion.div
          drag="x"
          dragConstraints={{ left: -100, right: 0 }}
          dragElastic={{ left: 0.15, right: 0 }}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
          className="flex-1 min-w-0 bg-[var(--color-background)]"
        >
          <Link href={`/remember/people/${person.id}`} className="block p-4">
            <div className="flex items-center gap-3">
              <Avatar name={person.name} color={relColor} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-card-title text-[var(--text-1)]">{person.name}</p>
                {person.notes?.length > 0 && (
                  <p className="text-[11px] text-[var(--color-text-3)] truncate">{person.notes[person.notes.length - 1]?.text}</p>
                )}
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <p className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border bg-opacity-10" style={{ color: relColor, borderColor: `${relColor}40`, backgroundColor: `${relColor}15` }}>
                  {person.relationship}
                </p>
                {person.next_meeting && (
                  <p className="text-[10px] text-[var(--color-text-3)]">{formatMeeting(person.next_meeting)}</p>
                )}
              </div>
            </div>
          </Link>
        </motion.div>
      </GlassCard>
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
    const { data, error } = await supabase.from("people").select("*").order("sort_order", { ascending: true, nullsFirst: false });
    if (error) {
      setFetchError(error.message);
    }
    setPeople(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { 
    fetchPeople(); 
  }, [fetchPeople]);
  
  useRealtime("people", fetchPeople);

  const now = new Date();
  const today = people.filter((p) => p.next_meeting && new Date(p.next_meeting).toDateString() === now.toDateString());
  const others = people.filter((p) => !p.next_meeting || new Date(p.next_meeting).toDateString() !== now.toDateString());

  const formatMeeting = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const deletePerson = async (person: Person) => {
    setPeople(prev => prev.filter(p => p.id !== person.id));

    try {
      const { error } = await supabase.from("people").delete().eq("id", person.id);
      if (error) throw error;
      
      toast.success("Person deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from("people").insert({
                  id: person.id,
                  user_id: user.id,
                  name: person.name,
                  relationship: person.relationship,
                  color: person.color,
                  notes: person.notes,
                  next_meeting: person.next_meeting,
                  sort_order: person.sort_order
                });
                fetchPeople();
              }
            } catch {
              toast.error("Failed to restore person");
              fetchPeople();
            }
          }
        }
      });
    } catch {
      toast.error("Failed to delete person");
      fetchPeople();
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPeople((items) => {
        const oldIndex = items.findIndex(x => x.id === active.id);
        const newIndex = items.findIndex(x => x.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        const updated = newItems.map((item, index) => ({ ...item, sort_order: index }));
        
        const payload = updated.map(u => ({ id: u.id, sort_order: u.sort_order }));
        fetch('/api/people/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload })
        }).catch(err => console.error("Failed to reorder:", err));

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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[var(--color-text-1)]">Today&apos;s Briefings</h2>
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse shadow-[var(--shadow-accent-glow)]" />
                </div>
                <button onClick={() => setIsPanelOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--accent)] text-card-title hover:bg-[var(--accent-dim-hover)] transition-colors">
                  <Plus className="w-4 h-4" /> Add person
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-1)] inline">All Contacts</h2>
                <span className="text-xs text-[var(--color-text-3)] font-normal ml-2">{others.length} people</span>
              </div>
              {today.length === 0 && (
                <button onClick={() => setIsPanelOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--accent)] text-card-title hover:bg-[var(--accent-dim-hover)] transition-colors">
                  <Plus className="w-4 h-4" /> Add person
                </button>
              )}
            </div>
            {others.length === 0 && today.length === 0 ? (
              <GlassCard className="p-8 text-center">
                {fetchError ? (
                  <p className="text-sm text-red-400">Error loading people: {fetchError}</p>
                ) : (
                  <p className="text-sm text-[var(--color-text-3)]">No people yet. Add someone or capture &ldquo;Riyaz said to...&rdquo;</p>
                )}
              </GlassCard>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={others.map(o => o.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {others.map(person => (
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

      <AddPersonPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} onPersonAdded={fetchPeople} />
    </div>
  );
}

