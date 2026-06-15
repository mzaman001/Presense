"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { AddPersonPanel } from "@/components/features/AddPersonPanel";
import { Plus, Loader2, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { ContextualTip } from "@/components/ui/ContextualTip";

interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  relationship: string;
  notes: Array<{ text: string; created_at: string; tag?: string }>;
  last_seen: string | null;
  next_meeting: string | null;
}

export default function PeoplePage() {
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"people" | "locations">("people");
  const [locations, setLocations] = useState<any[]>([]);

  const fetchPeople = useCallback(async () => {
    const { data } = await supabase.from("people").select("*").order("next_meeting", { ascending: true, nullsFirst: false });
    setPeople(data ?? []);
    setLoading(false);
  }, [supabase]);

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase.from("locations").select("*").order("created_at", { ascending: false });
    setLocations(data ?? []);
  }, [supabase]);

  useEffect(() => { 
    fetchPeople(); 
    fetchLocations();
  }, [fetchPeople, fetchLocations]);
  
  useRealtime("people", fetchPeople);
  useRealtime("locations", fetchLocations);

  const now = new Date();
  const today = people.filter((p) => p.next_meeting && new Date(p.next_meeting).toDateString() === now.toDateString());
  const others = people.filter((p) => !p.next_meeting || new Date(p.next_meeting).toDateString() !== now.toDateString());

  const formatMeeting = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <h1 className="text-[22px] font-medium text-white tracking-tight">Remember</h1>
        </div>
        {activeTab === "people" ? (
          <button onClick={() => setIsPanelOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(244,114,182,0.12)] border border-[rgba(244,114,182,0.25)] text-[#F472B6] text-sm font-medium hover:bg-[rgba(244,114,182,0.2)] transition-colors">
            <Plus className="w-4 h-4" /> Add person
          </button>
        ) : (
          <Link href="/locations" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.25)] text-[#4ADE80] text-sm font-medium hover:bg-[rgba(74,222,128,0.2)] transition-colors">
            <Plus className="w-4 h-4" /> Add location
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b border-[rgba(255,255,255,0.05)] pb-4">
        <button 
          onClick={() => setActiveTab("people")}
          className={cn("text-sm font-semibold px-4 py-2 rounded-lg transition-colors", activeTab === "people" ? "text-white bg-[rgba(255,255,255,0.1)]" : "text-[rgba(255,255,255,0.5)] hover:text-white")}
        >
          People
        </button>
        <button 
          onClick={() => setActiveTab("locations")}
          className={cn("text-sm font-semibold px-4 py-2 rounded-lg transition-colors", activeTab === "locations" ? "text-white bg-[rgba(255,255,255,0.1)]" : "text-[rgba(255,255,255,0.5)] hover:text-white")}
        >
          Locations
        </button>
      </div>

      <ContextualTip 
        id="remember_space" 
        title="What they told you, where things are" 
        description="This is the Remember space. Log gifts people like, or where you put your keys." 
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" />
        </div>
      ) : activeTab === "people" ? (
        <>
          {/* Today's meetings */}
          {today.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-white">Today&apos;s Briefings</h2>
                <span className="w-2 h-2 rounded-full bg-[#F472B6] animate-pulse" />
              </div>
              <div className="space-y-3">
                {today.map((person, i) => (
                  <motion.div key={person.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link href={`/people/${person.id}`}>
                      <GlassCard className="p-5 border-[rgba(244,114,182,0.3)] hover:scale-[1.01] transition-transform cursor-pointer">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={person.name} color={person.color} />
                            <div>
                              <p className="text-sm font-semibold text-white">{person.name}</p>
                              <p className="text-xs text-[#F472B6] flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Meeting at {new Date(person.next_meeting!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#F472B6] bg-[rgba(244,114,182,0.1)] border border-[rgba(244,114,182,0.2)] px-2 py-1 rounded-full">Briefing Ready</span>
                        </div>
                        {person.notes?.slice(-3).reverse().map((note, ni) => (
                          <p key={ni} className="text-xs text-[rgba(255,255,255,0.5)] flex items-start gap-1.5 mt-1">
                            <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-[#F472B6]" /> {note.text}
                          </p>
                        ))}
                      </GlassCard>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* All contacts */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">All Contacts</h2>
            {others.length === 0 && today.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <p className="text-sm text-[rgba(255,255,255,0.3)]">No people yet. Add someone or capture &ldquo;Riyaz said to...&rdquo;</p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {others.map((person, i) => (
                  <motion.div key={person.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link href={`/people/${person.id}`}>
                      <GlassCard className="p-4 hover:scale-[1.005] transition-transform cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Avatar name={person.name} color={person.color} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{person.name}</p>
                            {person.notes?.length > 0 && (
                              <p className="text-[11px] text-[rgba(255,255,255,0.4)] truncate">{person.notes[person.notes.length - 1]?.text}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] text-[rgba(255,255,255,0.35)] capitalize">{person.relationship}</p>
                            {person.next_meeting && (
                              <p className="text-[10px] text-[#F472B6]">{formatMeeting(person.next_meeting)}</p>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {locations.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="text-sm text-[rgba(255,255,255,0.3)]">No locations yet. Try capturing &ldquo;My passport is in the blue safe.&rdquo;</p>
            </GlassCard>
          ) : (
            locations.map((loc, i) => (
              <motion.div key={loc.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <GlassCard className="p-5 flex flex-col gap-2 border-[rgba(74,222,128,0.2)]">
                  <h3 className="text-lg font-medium text-white">{loc.item_name}</h3>
                  <p className="text-sm text-[#4ADE80]">{loc.location_text}</p>
                </GlassCard>
              </motion.div>
            ))
          )}
        </div>
      )}

      <AddPersonPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} onPersonAdded={fetchPeople} />
    </div>
  );
}
