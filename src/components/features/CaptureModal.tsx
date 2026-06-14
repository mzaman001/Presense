"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { CornerDownLeft, Sparkles, Loader2, Check, X, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { RoutedItem } from "@/lib/capture-router";

const SPACE_COLORS: Record<string, string> = {
  Do: "var(--color-do)",
  People: "var(--color-people)",
  Think: "var(--color-think)",
  Explore: "var(--color-explore)",
  Locations: "#4ADE80",
  Inbox: "#FBBF24",
  "Choose space...": "var(--color-text-3)",
};

const SPACES = ["Do", "People", "Think", "Explore", "Locations", "Inbox"];

export function CaptureModal() {
  const { isCaptureModalOpen, setCaptureModalOpen } = useAppStore();
  const [input, setInput] = useState("");
  const [isRouting, setIsRouting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [routedItems, setRoutedItems] = useState<RoutedItem[] | null>(null);
  const [taskExtras, setTaskExtras] = useState<{ [idx: number]: { first_step: string; ifthen_trigger: string } }>({});
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCaptureModalOpen(true);
      }
      if (e.key === "Escape") setCaptureModalOpen(false);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [setCaptureModalOpen]);

  useEffect(() => {
    if (!isCaptureModalOpen) {
      setTimeout(() => {
        setInput("");
        setRoutedItems(null);
        setTaskExtras({});
        setSaved(false);
      }, 200);
    }
  }, [isCaptureModalOpen]);

  const handleRoute = async () => {
    if (!input.trim()) return;
    setIsRouting(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      setRoutedItems(data.items ?? []);
    } catch {
      setRoutedItems([{ type: "unknown", title: input, destination: "Choose space..." }]);
      toast.error("Routing failed", { description: "Falling back to manual routing." });
    } finally {
      setIsRouting(false);
    }
  };

  const changeDestination = (idx: number, destination: string) => {
    setRoutedItems((prev) =>
      prev ? prev.map((item, i) => (i === idx ? { ...item, destination } : item)) : prev
    );
  };

  const updateRoutedItem = (idx: number, updates: Partial<RoutedItem>) => {
    setRoutedItems((prev) =>
      prev ? prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)) : prev
    );
  };

  const handleConfirm = async () => {
    if (!routedItems) return;
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsSaving(false); return; }

    try {
      await Promise.all(
        routedItems.map(async (item, idx) => {
          const extras = taskExtras[idx] ?? {};
          if (item.destination === "Do" || item.destination === "Inbox") {
            const { error } = await supabase.from("items").insert({
              user_id: user.id,
              title: item.title,
              first_step: extras.first_step || null,
              ifthen_trigger: extras.ifthen_trigger
                ? `When ${extras.ifthen_trigger}, I will ${extras.first_step || "do this"}`
                : null,
              deadline: item.deadline ? new Date(item.deadline).toISOString() : null,
              status: item.destination === "Inbox" ? "inbox" : "active",
            });
            if (error) throw new Error(`Tasks: ${error.message}`);
          } else if (item.destination === "People") {
            const { data: person } = await supabase
              .from("people")
              .select("id, notes")
              .eq("user_id", user.id)
              .ilike("name", `%${item.person ?? ""}%`)
              .maybeSingle();
            if (person) {
              const newNote = { text: item.title, created_at: new Date().toISOString(), tag: "note" };
              const { error } = await supabase.from("people").update({ notes: [...(person.notes ?? []), newNote] }).eq("id", person.id);
              if (error) throw new Error(`People: ${error.message}`);
            } else {
              const { error } = await supabase.from("people").insert({
                user_id: user.id,
                name: item.person || item.title.split(" ")[0],
                notes: [{ text: item.title, created_at: new Date().toISOString(), tag: "note" }]
              });
              if (error) throw new Error(`People: ${error.message}`);
            }
          } else if (item.destination === "Think") {
            const { error } = await supabase.from("threads").insert({
              user_id: user.id,
              title: item.title.slice(0, 60),
              entries: [{ text: item.title, created_at: new Date().toISOString(), starred: false }],
            });
            if (error) throw new Error(`Think: ${error.message}`);
          } else if (item.destination === "Explore") {
            const { error } = await supabase.from("explores").insert({
              user_id: user.id,
              title: item.title.slice(0, 100),
              type: item.url ? "link" : "concept",
              url: item.url ?? null,
              note: item.title,
            });
            if (error) throw new Error(`Explore: ${error.message}`);
          } else if (item.destination === "Locations") {
            const { error } = await supabase.from("locations").insert({
              user_id: user.id,
              item_name: item.item_name || item.title.split(" ")[0] || "Item",
              location_text: item.title,
            });
            if (error) throw new Error(`Locations: ${error.message}`);
          }
        })
      );
      setSaved(true);
      toast.success("Successfully captured!");
      setTimeout(() => setCaptureModalOpen(false), 800);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to save capture", { description: e.message || "An error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isCaptureModalOpen) return null;

  const hasTaskItems = routedItems?.some((item) => item.destination === "Do");

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setCaptureModalOpen(false)}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-[#0d0b18] border border-[rgba(255,255,255,0.12)] rounded-2xl shadow-2xl overflow-hidden"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 32px 64px rgba(0,0,0,0.6)" }}
        >
          {/* Input row */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(255,255,255,0.08)]">
            {routedItems ? (
              <Sparkles className="w-5 h-5 text-[var(--color-accent)] shrink-0 animate-pulse" />
            ) : (
              <Search className="w-5 h-5 text-[rgba(255,255,255,0.3)] shrink-0" />
            )}
            <input
              autoFocus
              type="text"
              placeholder='Capture anything... "Remind me to...", "Keys are in...", "Riyaz said..."'
              className="flex-1 bg-transparent border-none outline-none text-[15px] font-medium text-white placeholder:text-[rgba(255,255,255,0.25)]"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!!routedItems || isRouting}
              onKeyDown={(e) => { if (e.key === "Enter" && !routedItems) handleRoute(); }}
            />
            {!routedItems && (
              <kbd className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.1)] px-2 py-1 rounded-md bg-[rgba(255,255,255,0.04)]">
                Enter
              </kbd>
            )}
          </div>

          {/* Routing chips view */}
          {routedItems && !saved && (
            <div className="p-5 space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)] font-semibold">
                AI Extracted Context
              </p>
              {routedItems.map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <input
                    value={item.title}
                    onChange={(e) => updateRoutedItem(idx, { title: e.target.value })}
                    className="w-full bg-transparent text-lg text-white font-medium outline-none border-b border-[var(--color-border)] pb-2"
                  />
                  
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-2)]">
                    <span className="font-semibold">Space:</span>
                    <div className="relative group">
                      <button className="px-3 py-1 rounded-full border border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 transition-colors">
                        {item.destination}
                      </button>
                      <div className="absolute left-0 top-full mt-2 w-32 p-1 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-10 flex flex-col gap-1">
                        {SPACES.map(space => (
                          <button 
                            key={space} 
                            onClick={() => changeDestination(idx, space)}
                            className="text-left px-3 py-1.5 text-xs rounded-md hover:bg-[var(--color-surface)] text-[var(--color-text-1)]"
                          >
                            {space}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {item.destination === "Do" && (
                      <>
                        <span className="text-[var(--color-text-3)]">·</span>
                        <span className="font-semibold">Deadline:</span>
                        <input
                          type="datetime-local"
                          value={item.deadline ? new Date(new Date(item.deadline).getTime() - new Date(item.deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                          onChange={(e) => updateRoutedItem(idx, { deadline: e.target.value ? new Date(e.target.value).toISOString() : null })}
                          className="px-2 py-1 rounded-full border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-accent)] text-xs text-[var(--color-text-1)] [color-scheme:dark]"
                        />
                      </>
                    )}
                    
                    {item.destination === "People" && (
                      <>
                        <span className="text-[var(--color-text-3)]">·</span>
                        <span className="font-semibold">Person:</span>
                        <input
                          value={item.person || ""}
                          onChange={(e) => updateRoutedItem(idx, { person: e.target.value })}
                          className="px-2 py-1 rounded-full border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-accent)] text-xs text-[var(--color-text-1)]"
                          placeholder="Name..."
                        />
                      </>
                    )}
                    
                    {item.destination === "Locations" && (
                      <>
                        <span className="text-[var(--color-text-3)]">·</span>
                        <span className="font-semibold">Item:</span>
                        <input
                          value={item.item_name || ""}
                          onChange={(e) => updateRoutedItem(idx, { item_name: e.target.value })}
                          className="px-2 py-1 rounded-full border border-[var(--color-border)] bg-transparent outline-none focus:border-[var(--color-accent)] text-xs text-[var(--color-text-1)]"
                          placeholder="Item name..."
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Saved animation */}
          {saved && (
            <div className="flex items-center justify-center gap-2 p-6 text-[#4ADE80]">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">Saved!</span>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.2)]">
            {!routedItems ? (
              <>
                <span className="text-xs text-[rgba(255,255,255,0.3)]">
                  Smart routing via keyword detection — 100% free, no AI API
                </span>
                <button
                  onClick={handleRoute}
                  disabled={!input.trim() || isRouting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(139,124,248,0.15)] border border-[rgba(139,124,248,0.3)] text-[var(--color-accent)] text-sm font-medium hover:bg-[rgba(139,124,248,0.25)] transition-colors disabled:opacity-40"
                >
                  {isRouting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isRouting ? "Routing..." : "Route & Capture"}
                </button>
              </>
            ) : !saved ? (
              <>
                <button
                  onClick={() => setRoutedItems(null)}
                  className="flex items-center gap-1.5 text-sm text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" /> Start over
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isSaving || routedItems.some((i) => i.destination === "Choose space...")}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isSaving ? "Saving..." : "Confirm & Save"}
                </button>
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
