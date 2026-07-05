"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { Search, X, Loader2, CheckSquare, Users, MessageSquare, Compass, MapPin, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { ModalErrorBoundary } from "@/components/ui/ModalErrorBoundary";
import { Sheet } from "@/components/ui/Sheet";
import { useHaptics } from "@/hooks/useHaptics";
import { Icon as UiIcon } from "@/components/ui/Icon";

export function SearchModal() {
  const { isSearchModalOpen, setSearchModalOpen } = useAppStore();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const dialogRef = useDialogFocus(isSearchModalOpen);
  const haptics = useHaptics();

  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      haptics.selection();
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isSearchModalOpen]);

  useEffect(() => {
    async function performSearch() {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const q = `%${debouncedQuery}%`;

      const [tasks, people, threads, explores, locations] = await Promise.all([
        supabase.from("items").select("id, title").or(`title.ilike.${q},category.ilike.${q}`).limit(5),
        supabase.from("people").select("id, name").or(`name.ilike.${q},relationship.ilike.${q}`).limit(5),
        supabase.from("threads").select("id, title").or(`title.ilike.${q}`).limit(5),
        supabase.from("explores").select("id, title").or(`title.ilike.${q},tags.cs.{${debouncedQuery}}`).limit(5),
        supabase.from("locations").select("id, item_name, location_text").or(`item_name.ilike.${q},location_text.ilike.${q}`).limit(5)
      ]);

      const combined = [
        ...(tasks.data || []).map((t: any) => ({ ...t, type: "task", icon: CheckSquare, path: "/do" })),
        ...(people.data || []).map((p: any) => ({ ...p, title: p.name, type: "person", icon: Users, path: "/people" })),
        ...(threads.data || []).map((t: any) => ({ ...t, type: "thread", icon: MessageSquare, path: `/think/${t.id}` })),
        ...(explores.data || []).map((e: any) => ({ ...e, type: "explore", icon: Compass, path: "/explore" })),
        ...(locations.data || []).map((l: any) => ({ ...l, title: `${l.item_name} - ${l.location_text}`, type: "location", icon: MapPin, path: "/locations" }))
      ];

      setResults(combined);
      setLoading(false);
      setSelectedIndex(0);
    }
    performSearch();
  }, [debouncedQuery, supabase]);

  if (!isSearchModalOpen) return null;

  return (
    <ModalErrorBoundary modalName="Search Modal" onClose={() => setSearchModalOpen(false)}>
      <Sheet isOpen={isSearchModalOpen} onClose={() => setSearchModalOpen(false)}>
        <div className="relative w-full max-w-2xl mx-auto overflow-hidden">
          <div className="flex items-center px-4 border-b border-[var(--color-border)]">
              <UiIcon size={13} strokeWidth={1.5} className="text-[var(--text-3)] ml-2" icon={Search} />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                autoComplete="off"
                autoCapitalize="none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && results.length > 0) {
                    e.preventDefault();
                    const selected = results[selectedIndex];
                    if (selected) {
                      setSearchModalOpen(false);
                      router.push(selected.path);
                    }
                  }
                }}
                placeholder="Search everything..."
                className="flex-1 bg-transparent border-none text-[var(--color-text-1)] text-lg py-4 pl-4 focus:outline-none focus:ring-0 placeholder-[rgba(255,255,255,0.3)]"
              />
              {query && (
                <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search" className="p-2 ml-1 mr-1 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] rounded-lg hover:bg-[var(--color-surface)] transition-colors">
                  <UiIcon className="w-4 h-4" icon={X} />
                </button>
              )}
              {loading && <UiIcon className="w-5 h-5 animate-spin text-[var(--color-text-3)]" icon={Loader2} />}
              <div className="w-px h-6 bg-[var(--color-border)] mx-1"></div>
              <button onClick={() => setSearchModalOpen(false)} aria-label="Close search modal" className="p-2 ml-1 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] rounded-lg hover:bg-[var(--color-surface)] transition-colors">
                <span className="text-caption font-mono mr-1 border border-[rgba(255,255,255,0.2)] rounded px-1 hidden sm:inline-block">ESC</span>
                <UiIcon className="w-5 h-5 hidden" icon={X} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2" data-lenis-prevent>
              {!query && (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-4">
                    <UiIcon className="w-6 h-6 text-[var(--color-text-3)]" icon={Search} />
                  </div>
                  <h3 className="text-[var(--color-text-1)] font-medium mb-2">Search your brain</h3>
                  <p className="text-sm text-[var(--color-text-3)] max-w-[250px]">Type to search across tasks, people, threads, explores, and locations.</p>
                </div>
              )}
              
              {query && !loading && results.length === 0 && (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center mb-4">
                    <UiIcon className="w-6 h-6 text-[var(--color-text-3)]" icon={AlertCircle} />
                  </div>
                  <h3 className="text-[var(--color-text-1)] font-medium mb-2">No results</h3>
                  <p className="text-sm text-[var(--color-text-3)]">No results found for &ldquo;{query}&rdquo;</p>
                </div>
              )}

              {results.map((result, i) => (
                <button
                  key={`${result.type}-${result.id}-${i}`}
                  onClick={() => {
                    setSearchModalOpen(false);
                    router.push(result.path);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-3 rounded-xl text-left transition-colors group",
                    i === selectedIndex
                      ? "bg-[var(--color-surface)] text-[var(--color-text-1)]"
                      : "hover:bg-[var(--color-surface)] text-[var(--color-text-1)]"
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-3)] group-hover:text-[var(--color-text-1)] group-hover:bg-[var(--color-surface)] transition-colors">
                    <result.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[var(--color-text-1)] font-medium truncate">{result.title}</div>
                    <div className="text-xs text-[var(--color-text-3)] capitalize">{result.type}</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between text-xs text-[var(--color-text-3)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">↑</kbd><kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">↓</kbd> to navigate</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">Enter</kbd> to select</span>
              </div>
              <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">Esc</kbd> to close</span>
            </div>
          </div>
      </Sheet>
    </ModalErrorBoundary>
  );
}
