"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { AddPersonPanel } from "@/components/features/AddPersonPanel";
import { Plus, Loader2, Clock, ChevronRight, GripVertical } from "lucide-react";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { ContextualTip } from "@/components/ui/ContextualTip";

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

const RELATIONSHIP_COLORS: Record<string, string> = {
  friend: '#F472B6',
  family: '#A78BFA',
  colleague: '#60A5FA',
  professor: '#FCD34D',
  other: '#9CA3AF',
};

function SortablePersonRow({ person, formatMeeting }: { person: Person, formatMeeting: (d: string) => string }) {
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

  const relColor = RELATIONSHIP_COLORS[person.relationship] || RELATIONSHIP_COLORS.other;

  return (
    <motion.div ref={setNodeRef} style={style} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn(isDragging && "opacity-50")}>
      <GlassCard className="p-0 hover:scale-[1.005] transition-transform overflow-hidden flex items-stretch">
        <div {...attributes} {...listeners} className="w-8 flex items-center justify-center bg-[var(--color-surface)] border-r border-[var(--color-border)] cursor-grab active:cursor-grabbing hover:bg-[var(--color-surface)] transition-colors">
          <GripVertical className="w-4 h-4 text-[var(--color-text-3)]" />
        </div>
        <Link href={`/people/${person.id}`} className="flex-1 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={person.name} color={relColor} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-1)]">{person.name}</p>
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
      </GlassCard>
    </motion.div>
  );
}

export default function PeoplePage() {
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const fetchPeople = useCallback(async () => {
    const { data } = await supabase.from("people").select("*").order("sort_order", { ascending: true, nullsFirst: false });
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
        
        // Update sort_order locally
        const updated = newItems.map((item, index) => ({ ...item, sort_order: index }));
        
        // Persist to DB without waiting
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
    <div className="space-y-6">
      <div className="flex items-center justify-end mb-2">
        <button onClick={() => setIsPanelOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(244,114,182,0.12)] border border-[rgba(244,114,182,0.25)] text-[#F472B6] text-sm font-medium hover:bg-[rgba(244,114,182,0.2)] transition-colors">
          <Plus className="w-4 h-4" /> Add person
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-3)]" />
        </div>
      ) : (
        <>
          {/* Today's meetings */}
          {today.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-1)]">Today&apos;s Briefings</h2>
                <span className="w-2 h-2 rounded-full bg-[#F472B6] animate-pulse" />
              </div>
              <div className="space-y-3">
                {today.map((person, i) => {
                  const relColor = RELATIONSHIP_COLORS[person.relationship] || RELATIONSHIP_COLORS.other;
                  return (
                    <motion.div key={person.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link href={`/people/${person.id}`}>
                        <GlassCard className="p-5 border-[rgba(244,114,182,0.3)] hover:scale-[1.01] transition-transform cursor-pointer">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={person.name} color={relColor} />
                              <div>
                                <p className="text-sm font-semibold text-[var(--color-text-1)]">{person.name}</p>
                                <p className="text-xs text-[#F472B6] flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Meeting at {new Date(person.next_meeting!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F472B6] bg-[rgba(244,114,182,0.1)] border border-[rgba(244,114,182,0.2)] px-2 py-1 rounded-full">Briefing Ready</span>
                          </div>
                          {person.notes?.slice(-3).reverse().map((note, ni) => (
                            <p key={ni} className="text-xs text-[var(--color-text-3)] flex items-start gap-1.5 mt-1">
                              <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-[#F472B6]" /> {note.text}
                            </p>
                          ))}
                        </GlassCard>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All contacts with DND */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-1)] mb-3 mt-8">All Contacts</h2>
            {others.length === 0 && today.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <p className="text-sm text-[var(--color-text-3)]">No people yet. Add someone or capture &ldquo;Riyaz said to...&rdquo;</p>
              </GlassCard>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={others.map(o => o.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {others.map(person => (
                      <SortablePersonRow key={person.id} person={person} formatMeeting={formatMeeting} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}

      <AddPersonPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} onPersonAdded={fetchPeople} />
    </div>
  );
}
