"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowLeft, Loader2, Sparkles, Plus, X, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [deleteNameConfirm, setDeleteNameConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);

  const fetchPerson = useCallback(async () => {
    const { data: personData } = await supabase.from("people").select("*").eq("id", id).single();
    if (personData) {
      setPerson(personData);
      const { data: tasksData } = await supabase
        .from("items")
        .select("*")
        .ilike("title", `%${personData.name}%`)
        .in("status", ["active", "overdue", "inbox"]);
      setLinkedTasks(tasksData ?? []);
    }
    setLoading(false);
  }, [supabase, id]);

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

  const handleDeleteNote = async (indexToRemove: number) => {
    if (!person || !person.notes) return;
    const updatedNotes = person.notes.filter((_, idx) => idx !== indexToRemove);
    try {
      const { error } = await supabase.from("people").update({ notes: updatedNotes }).eq("id", person.id);
      if (error) throw error;
      setPerson({ ...person, notes: updatedNotes });
      toast.success("Note removed");
    } catch (err: any) {
      toast.error("Failed to remove note", { description: err.message });
    }
  };

  const handleDeletePerson = async () => {
    if (!person || deleteNameConfirm !== person.name) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("people").delete().eq("id", person.id);
      if (error) throw error;
      toast.success("Person deleted");
      router.push("/people");
    } catch (err: any) {
      toast.error("Failed to delete person", { description: err.message });
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" /></div>;
  }

  if (!person) {
    return <div className="text-center py-20 text-[rgba(255,255,255,0.5)]">Person not found.</div>;
  }

  // Reverse notes so newest is at the top of the timeline
  const timeline = [...(person.notes || [])].reverse();
  const briefing = timeline.slice(0, 3); // top 3 for briefing

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Link href="/people" className="inline-flex items-center gap-2 text-sm text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to People
      </Link>

      <div className="flex items-center gap-4">
        <Avatar name={person.name} color={person.color} size="lg" className="w-16 h-16 text-xl" />
        <div>
          <h1 className="text-[26px] font-semibold text-white tracking-tight leading-none mb-1">{person.name}</h1>
          <p className="text-sm text-[rgba(255,255,255,0.4)] capitalize">{person.relationship}</p>
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
              <li key={i} className="text-sm text-white leading-relaxed flex items-start gap-2">
                <span className="text-[#F472B6] mt-0.5">•</span> {note.text}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {linkedTasks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-4">Linked Tasks</h3>
          <div className="space-y-2">
            {linkedTasks.map((task) => (
              <GlassCard key={task.id} className="p-4 border-[rgba(255,255,255,0.05)] flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-white">{task.title}</p>
                  {task.first_step && <p className="text-xs text-[#2DD4BF] mt-1">{task.first_step}</p>}
                </div>
                <Link href={`/do`} className="text-xs px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors">
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
            className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-4 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none focus:border-[#F472B6] focus:bg-[rgba(244,114,182,0.03)] transition-all pr-12"
          />
          <button type="submit" disabled={!newNote.trim() || saving} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(244,114,182,0.15)] text-[#F472B6] hover:bg-[rgba(244,114,182,0.25)] transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </form>

        <h3 className="text-xs font-semibold text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-4">Timeline</h3>
        <div className="space-y-4">
          {timeline.length === 0 ? (
            <p className="text-sm text-[rgba(255,255,255,0.3)] text-center py-8 border border-dashed border-[rgba(255,255,255,0.1)] rounded-xl">No notes yet.</p>
          ) : (
            timeline.map((note, i) => {
              const originalIndex = timeline.length - 1 - i;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <GlassCard className="p-4 group relative">
                    <button 
                      onClick={() => handleDeleteNote(originalIndex)}
                      className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 bg-[rgba(248,113,113,0.1)] text-[#F87171] rounded-md transition-opacity hover:bg-[rgba(248,113,113,0.2)]"
                      title="Delete note"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-sm text-white leading-relaxed mb-2 pr-6">{note.text}</p>
                    <p className="text-[11px] text-[rgba(255,255,255,0.3)]">
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
        <p className="text-sm text-[rgba(255,255,255,0.4)] mb-4">
          Deleting a person is permanent. It will remove all their notes and history.
        </p>
        <div className="flex items-center gap-3 bg-[rgba(248,113,113,0.05)] p-4 rounded-xl border border-[rgba(248,113,113,0.1)]">
          <input 
            type="text" 
            placeholder={`Type "${person.name}" to confirm`}
            value={deleteNameConfirm}
            onChange={(e) => setDeleteNameConfirm(e.target.value)}
            className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.2)] outline-none focus:border-[#F87171]"
          />
          <button 
            onClick={handleDeletePerson}
            disabled={deleteNameConfirm !== person.name || isDeleting}
            className="px-4 py-2 bg-[rgba(248,113,113,0.2)] text-[#F87171] rounded-lg text-sm font-medium hover:bg-[#F87171] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
            Delete Person
          </button>
        </div>
      </div>
    </div>
  );
}
