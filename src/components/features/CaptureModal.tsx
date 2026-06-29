"use client";
import { logger } from "@/lib/logger";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { formatRRule, cn, extractMentions } from "@/lib/utils";
import { Sparkles, Loader2, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import type { RoutedItem } from "@/lib/capture-router";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalErrorBoundary } from "@/components/ui/ModalErrorBoundary";

function formatCaptureDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  
  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  
  const diffTime = d.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 3600 * 24);
  if (diffDays > 0 && diffDays < 7) {
    return `Next ${d.toLocaleDateString('en-US', { weekday: 'long' })} ${time}`;
  }
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
}

const SPACE_COLORS: Record<string, string> = {
  Do: "var(--color-do)",
  "Remember → People": "var(--color-people)",
  Think: "var(--color-think)",
  Explore: "var(--color-explore)",
  "Remember → Locations": "#4ADE80",
  Inbox: "#FBBF24",
  "Choose space...": "var(--color-text-3)",
};

const SPACE_OPTIONS = [
  { value: "Do", label: "Do" },
  { value: "Think", label: "Think" },
  { value: "Remember → People", label: "People" },
  { value: "Remember → Locations", label: "Locations" },
  { value: "Explore", label: "Explore" },
  { value: "Inbox", label: "Inbox" }
];

const toLocalISOString = (date: Date) => {
  // Use date-fns to format in local time as YYYY-MM-DDTHH:mm
  // This avoids timezone math issues around DST
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function CaptureModal() {
  const { isCaptureModalOpen, setCaptureModalOpen, userSettings, captureModalPrefill, setCaptureModalPrefill } = useAppStore();
  const [input, setInput] = useState("");
  const [lastRoutedInput, setLastRoutedInput] = useState("");
  const [isRouting, setIsRouting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [routedItems, setRoutedItems] = useState<RoutedItem[] | null>(null);
  const [taskExtras, setTaskExtras] = useState<{ [idx: number]: { first_step: string; ifthen_trigger: string } }>({});
  const [saved, setSaved] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverSearch, setPopoverSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    async function fetchPeople() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("people").select("id, name").eq("user_id", user.id);
      if (data) {
        setPeople(data);
      }
    }
    if (isCaptureModalOpen) {
      fetchPeople();
    }
  }, [isCaptureModalOpen, supabase]);

  const filteredPeople = useMemo(() => {
    return people.filter(p =>
      p.name.toLowerCase().includes(popoverSearch.toLowerCase())
    );
  }, [people, popoverSearch]);

  const handleSelectPerson = useCallback((person: { id: string; name: string }) => {
    if (!inputRef.current) return;
    const val = input;
    const selectionStart = inputRef.current.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const textAfterCursor = val.slice(selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    const mentionText = `@[${person.name}](${person.id})`;
    const newVal = val.slice(0, lastAtIndex) + mentionText + " " + textAfterCursor;
    setInput(newVal);
    setShowPopover(false);

    // Focus input and move cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const cursorPosition = lastAtIndex + mentionText.length + 1;
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  }, [input]);

  const handleInputChange = (val: string) => {
    setInput(val);

    if (!inputRef.current) return;
    const selectionStart = inputRef.current.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === " ")) {
      const search = textBeforeCursor.slice(lastAtIndex + 1);
      if (!search.includes(" ")) {
        setShowPopover(true);
        setPopoverSearch(search);
        setSelectedIndex(0);
        return;
      }
    }
    setShowPopover(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showPopover && filteredPeople.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredPeople.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredPeople.length) % filteredPeople.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectPerson(filteredPeople[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowPopover(false);
      }
    } else {
      if (e.key === "Enter") {
        if (!routedItems || input !== lastRoutedInput) {
          handleRoute();
        } else {
          handleConfirm();
        }
      }
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const isInput = (e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;
      
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCaptureModalOpen(true);
      }
      
      if (!isInput && !e.metaKey && !e.ctrlKey) {
        if (e.key === "c" || e.key === "n") {
          e.preventDefault();
          setCaptureModalOpen(true);
        }
      }

      if (e.key === "Escape") setCaptureModalOpen(false);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [setCaptureModalOpen]);



  useEffect(() => {
    if (isCaptureModalOpen) {
      // If a prefill string was set (e.g., from clicking a calendar slot), populate input
      if (captureModalPrefill) {
        setInput(captureModalPrefill);
        setCaptureModalPrefill(null);
      }
    } else {
      const timer = setTimeout(() => {
        setInput("");
        setRoutedItems(null);
        setTaskExtras({});
        setSaved(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isCaptureModalOpen, captureModalPrefill, setCaptureModalPrefill]);

  const handleRoute = useCallback(async () => {
    if (!input.trim()) return;
    setIsRouting(true);
    setLastRoutedInput(input);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, settings: userSettings }),
      });
      const data = await res.json();
      setRoutedItems(data.items ?? []);
    } catch {
      setRoutedItems([{ type: "unknown", title: input, destination: "Choose space..." }]);
      toast.error("Routing failed", { description: "Falling back to manual routing." });
    } finally {
      setIsRouting(false);
    }
  }, [input, userSettings]);

  // Auto-routing removed. Routing now only happens on Enter key press.

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
            const mentions = extractMentions(item.title);
            const { error } = await supabase.from("items").insert({
              user_id: user.id,
              title: item.title,
              first_step: extras.first_step || null,
              ifthen_trigger: extras.ifthen_trigger
                ? `When ${extras.ifthen_trigger}, I will ${extras.first_step || "do this"}`
                : null,
              deadline: item.deadline ? new Date(item.deadline).toISOString() : null,
              recurrence: (item as RoutedItem & { recurrence?: string }).recurrence ?? null,
              status: item.destination === "Inbox" ? "inbox" : "active",
              linked_people: mentions,
            });
            if (error) throw new Error(`Tasks: ${error.message}`);
          } else if (item.destination === "Remember → People") {
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
            const mentions = extractMentions(item.title);
            const { error } = await supabase.from("threads").insert({
              user_id: user.id,
              title: item.title.slice(0, 60),
              entries: [{ text: item.title, created_at: new Date().toISOString(), starred: false }],
              linked_people: mentions,
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
          } else if (item.destination === "Remember → Locations") {
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "An error occurred";
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to save capture", { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalErrorBoundary modalName="Capture Modal" onClose={() => setCaptureModalOpen(false)}>
      <AnimatePresence>
        {isCaptureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCaptureModalOpen(false)}
          />
          <m.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 26, duration: 0.22 }}
            className="modal relative w-full max-w-2xl"
          >
            {/* Input row */}
            <div
              className="flex items-center gap-3 px-5 py-4 border-b rounded-t-2xl relative transition-all duration-300"
              style={{
                borderColor: inputFocused ? "rgba(229,180,30,0.3)" : "rgba(255,255,255,0.08)",
                boxShadow: inputFocused
                  ? "inset 0 0 0 1px rgba(229,180,30,0.15), 0 0 20px rgba(229,180,30,0.08), 0 0 40px rgba(229,180,30,0.04)"
                  : "none",
              }}
            >
              {routedItems ? (
                <Sparkles className="w-5 h-5 text-[var(--color-accent)] shrink-0 animate-pulse" />
              ) : (
                <Search className="w-5 h-5 text-[var(--color-text-3)] shrink-0" />
              )}
              <input
                ref={inputRef}
                autoFocus
                type="text"
                placeholder='Capture anything... "Remind me to...", "Keys are in...", "Riyaz said..."'
                className="flex-1 bg-transparent border-none outline-none text-[15px] font-medium text-[var(--color-text-1)] placeholder:text-[rgba(255,255,255,0.25)]"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                disabled={isRouting}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
              {input && !routedItems && !isRouting && (
                <button onClick={() => { handleInputChange(""); inputRef.current?.focus(); }} aria-label="Clear input" className="p-1 mr-1 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] rounded hover:bg-[var(--color-surface)] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
              {!routedItems && (
                <kbd className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-3)] border border-[var(--color-border)] px-2 py-1 rounded-md bg-[var(--color-surface)]">
                  Enter
                </kbd>
              )}

              {/* Mentions dropdown overlay */}
              {showPopover && filteredPeople.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-lg max-h-60 overflow-y-auto"
                  data-testid="mentions-popover"
                >
                  {filteredPeople.map((person, idx) => (
                    <button
                      key={person.id}
                      onClick={() => handleSelectPerson(person)}
                      className={cn(
                        "w-full px-4 py-2 text-left hover:bg-[rgba(255,255,255,0.05)] focus:outline-none text-sm text-[var(--color-text-1)]",
                        idx === selectedIndex && "bg-[rgba(255,255,255,0.08)]"
                      )}
                      type="button"
                    >
                      {person.name}
                    </button>
                  ))}
                </div>
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleConfirm();
                        }
                      }}
                      className="input-title bg-transparent border-none outline-none font-semibold text-lg text-[var(--color-text-1)] w-full placeholder:text-[rgba(255,255,255,0.25)]"
                    />
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-2)]">
                      <span className="font-semibold">Space:</span>
                      <Dropdown
                        value={item.destination}
                        onChange={(val) => changeDestination(idx, val)}
                        options={SPACE_OPTIONS}
                        colors={SPACE_COLORS}
                        placeholder="Choose space..."
                      />
                      
                      {item.destination === "Do" && (
                        <>
                          {item.recurrence && (
                            <>
                              <span className="text-[var(--color-text-3)]">·</span>
                              <span className="font-semibold">Recurrence:</span>
                              <span className="px-3 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text-1)]">
                                {formatRRule(item.recurrence)}
                              </span>
                            </>
                          )}
                          <span className="text-[var(--color-text-3)]">·</span>
                          <span className="font-semibold">Deadline:</span>
                          <div className="relative inline-flex items-center">
                            <span className="px-3 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text-1)] pointer-events-none whitespace-nowrap">
                              {item.deadline ? formatCaptureDeadline(item.deadline) : "No deadline"} ▼
                            </span>
                            <input
                              type="datetime-local"
                              value={item.deadline ? toLocalISOString(new Date(item.deadline)) : ""}
                              onChange={(e) => updateRoutedItem(idx, { deadline: e.target.value ? new Date(e.target.value).toISOString() : null })}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                        </>
                      )}
                      
                      {item.destination === "Remember → People" && (
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
                      
                      {item.destination === "Remember → Locations" && (
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
              <m.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: [0.8, 1.15, 0.95, 1] }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex items-center justify-center gap-2 p-6 text-[#4ADE80]"
              >
                <m.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 12, delay: 0.1 }}
                >
                  <Check className="w-5 h-5" />
                </m.div>
                <span className="text-sm font-medium">Saved!</span>
              </m.div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] rounded-b-2xl">
              {!routedItems ? (
                <>
                  <span className="text-xs text-[var(--color-text-3)] flex items-center gap-1.5">
                    Press <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-[var(--border-default)] text-[10px] text-[var(--text-1)] border border-[var(--border-subtle)]">Enter</kbd> to auto-route
                  </span>
                  <button
                    onClick={handleRoute}
                    disabled={!input.trim() || isRouting}
                    className="btn-primary disabled:opacity-50"
                  >
                    {isRouting ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin shrink-0" /> : <Sparkles size={14} strokeWidth={1.5} className="shrink-0" />}
                    {isRouting ? "Routing..." : "Route & Capture"}
                  </button>
                </>
              ) : !saved ? (
                <>
                  <button
                    onClick={() => setRoutedItems(null)}
                    className="btn-secondary"
                  >
                    <X size={14} strokeWidth={1.5} className="shrink-0" /> Start over
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isSaving || routedItems.some((i) => i.destination === "Choose space...")}
                    className="btn-primary disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin shrink-0" /> : <Check size={14} strokeWidth={1.5} className="shrink-0" />}
                    {isSaving ? "Saving..." : "Confirm & Save"}
                  </button>
                </>
              ) : null}
            </div>
          </m.div>
        </div>
        )}
      </AnimatePresence>
    </ModalErrorBoundary>
  );
}
