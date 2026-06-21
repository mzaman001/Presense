"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowLeft, Loader2, Sparkles, Plus, X, Trash2, Edit2, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dropdown } from "@/components/ui/Dropdown";
import { RELATIONSHIP_COLORS } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

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

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [noteToDelete, setNoteToDelete] = useState<number | null>(null);
  const [personToDelete, setPersonToDelete] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");

  const { userSettings } = useAppStore();

  const fetchPerson = useCallback(async () => {
    const { data: personData } = await supabase.from("people").select("*").eq("id", id).single();
    if (personData) {
      setPerson(personData);
      const { data: tasksData } = await supabase
        .from("items")
        .select("*")
        .contains("linked_people_ids", [id])
        .in("status", ["active", "overdue", "inbox"]);
      setLinkedTasks(tasksData ?? []);
    }
    setLoading(false);
  }, [supabase, id]);

  const updateRelationship = async (newRel: string) => {
    if (!person) return;
    setPerson({ ...person, relationship: newRel });
    try {
      const { error } = await supabase.from("people").update({ relationship: newRel }).eq("id", person.id);
      if (error) throw error;
      toast.success("Relationship updated");
    } catch (err: any) {
      toast.error("Failed to update", { description: err.message });
    }
  };

  const handleUpdateName = async () => {
    if (!person || !editName.trim() || editName.trim() === person.name) {
      setIsEditingName(false);
      return;
    }
    const newName = editName.trim();
    // Recompute initials just to be safe
    const newInitials = newName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    
    setPerson({ ...person, name: newName, initials: newInitials });
    setIsEditingName(false);
    try {
      const { error } = await supabase.from("people").update({ name: newName, initials: newInitials }).eq("id", person.id);
      if (error) throw error;
      toast.success("Name updated");
    } catch (err: any) {
      toast.error("Failed to update name", { description: err.message });
      // Revert on error
      fetchPerson();
    }
  };

  useEffect(() => { fetchPerson(); }, [fetchPerson]);
  useRealtime("people", fetchPerson);
  useRealtime("items", fetchPerson);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !person) return;
    setSaving(true);
    
    const note = { text: newNote.trim(), created_at: new Date().toISOString() };
    const updatedNotes = [...(person.notes || []), note];
    
    try {
      const { error } = await supabase.from("people").update({ 
        notes: updatedNotes,
        last_seen: new Date().toISOString()
      }).eq("id", person.id);
      
      if (error) throw error;
      
      setPerson({ ...person, notes: updatedNotes, last_seen: new Date().toISOString() });
      setNewNote("");
      toast.success("Note added");
    } catch (err: any) {
      toast.error("Failed to add note", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteNote = async () => {
    if (noteToDelete === null || !person || !person.notes) return;
    const updatedNotes = person.notes.filter((_, idx) => idx !== noteToDelete);
    try {
      const { error } = await supabase.from("people").update({ notes: updatedNotes }).eq("id", person.id);
      if (error) throw error;
      setPerson({ ...person, notes: updatedNotes });
      toast.success("Note removed");
    } catch (err: any) {
      toast.error("Failed to remove note", { description: err.message });
    } finally {
      setNoteToDelete(null);
    }
  };

  const handleDeletePerson = async () => {
    if (!person) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("people").delete().eq("id", person.id);
      if (error) throw error;
      toast.success(`${person.name} deleted`);
      router.push("/remember/people");
    } catch (err: any) {
      toast.error("Failed to delete person", { description: err.message });
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-3)]" /></div>;
  }

  if (!person) {
    return <div className="text-center py-20 text-[var(--color-text-3)]">Person not found.</div>;
  }

  // Reverse notes so newest is at the top of the timeline
  const timeline = [...(person.notes || [])].reverse();
  const briefing = timeline.slice(0, 3); // top 3 for briefing

  const relKey = (person.relationship || '').toLowerCase();
  const relColor = person.color || userSettings?.relationship_colors?.[relKey] || RELATIONSHIP_COLORS[relKey] || RELATIONSHIP_COLORS.other;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Link href="/remember/people" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to People
      </Link>

      <div className="flex items-center gap-4">
        <Avatar name={person.name} color={relColor} size="lg" className="w-16 h-16 text-xl" />
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                className="bg-[rgba(255,255,255,0.05)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[20px] font-semibold text-[var(--color-text-1)] outline-none focus:border-[var(--accent)] w-full max-w-[300px]"
              />
              <button onClick={handleUpdateName} className="p-1.5 rounded-md text-green-500 hover:bg-green-500/10 transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setIsEditingName(false)} className="p-1.5 rounded-md text-[var(--color-text-3)] hover:bg-[var(--color-surface)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group mb-1">
              <h1 className="text-[26px] font-semibold text-[var(--color-text-1)] tracking-tight leading-none">{person.name}</h1>
              <button 
                onClick={() => {
                  setEditName(person.name);
                  setIsEditingName(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface)] transition-all"
                title="Edit name"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="mt-2">
            <Dropdown
              value={person.relationship.toLowerCase()}
              onChange={updateRelationship}
              options={(userSettings?.people_categories || ["friend", "family", "professor", "colleague", "teammate", "other"]).map((c: string) => ({ value: c, label: c }))}
              colors={RELATIONSHIP_COLORS}
              variant="chip"
              className="w-fit inline-block uppercase tracking-widest [&>button]:!px-2 [&>button]:!py-0.5 [&>button]:!text-sm"
            />
          </div>
        </div>
      </div>

      {briefing.length > 0 && (
        <GlassCard className="p-6 border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.03)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#F472B6]" />
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#F472B6]" />
            <h2 className="text-sm font-semibold text-[#F472B6] tracking-widest uppercase">Briefing</h2>
          </div>
          <ul className="space-y-3">
            {briefing.map((note, i) => (
              <li key={i} className="text-sm text-[var(--color-text-1)] leading-relaxed flex items-start gap-2">
                <span className="text-[#F472B6] mt-0.5">•</span> {note.text}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {linkedTasks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-4">Linked Tasks</h3>
          <div className="space-y-2">
            {linkedTasks.map((task) => (
              <GlassCard key={task.id} className="p-4 border-[var(--color-border)] flex justify-between items-center">
                <div>
                  <p className="text-card-title text-[var(--text-1)]">{task.title}</p>
                  {task.first_step && <p className="text-xs text-[#2DD4BF] mt-1">{task.first_step}</p>}
                </div>
                <Link href={`/do`} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-1)] hover:bg-[var(--color-surface)] transition-colors">
                  View in Do
                </Link>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      <div>
        <form onSubmit={handleAddNote} className="mb-6 relative">
          <input
            placeholder={`Add a note about ${person.name}...`}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] rounded-xl px-4 py-4 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[#F472B6] focus:bg-[rgba(244,114,182,0.03)] transition-all pr-12"
          />
          <button type="submit" disabled={!newNote.trim() || saving} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(244,114,182,0.15)] text-[#F472B6] hover:bg-[rgba(244,114,182,0.25)] transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </form>

        <h3 className="text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-4">Timeline</h3>
        <div className="space-y-4">
          {timeline.length === 0 ? (
            <p className="text-sm text-[var(--color-text-3)] text-center py-8 border border-dashed border-[var(--color-border)] rounded-xl">No notes yet.</p>
          ) : (
            timeline.map((note, i) => {
              const originalIndex = timeline.length - 1 - i;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <GlassCard className="p-4 group relative">
                    <button 
                      onClick={() => setNoteToDelete(originalIndex)}
                      className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 bg-[rgba(248,113,113,0.1)] text-[#F87171] rounded-md transition-opacity hover:bg-[rgba(248,113,113,0.2)]"
                      title="Delete note"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-sm text-[var(--color-text-1)] leading-relaxed mb-2 pr-6">{note.text}</p>
                    <p className="text-[11px] text-[var(--color-text-3)]">
                      {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-12 mt-12 border-t border-dashed border-[rgba(248,113,113,0.2)]">
        <h3 className="text-sm font-semibold text-[#F87171] mb-2 flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-sm text-[var(--color-text-3)] mb-4">
          Deleting a person is permanent. It will remove all their notes and history.
        </p>
        <button 
          onClick={() => setPersonToDelete(true)}
          className="px-4 py-2 bg-[rgba(248,113,113,0.1)] text-[#F87171] rounded-lg text-card-title hover:bg-[rgba(248,113,113,0.2)] transition-colors flex items-center gap-2"
        >
          {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
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
