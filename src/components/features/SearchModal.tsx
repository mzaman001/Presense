"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { Search, X, Loader2, CheckSquare, Users, MessageSquare, Compass, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import { cn } from "@/lib/utils";

export function SearchModal() {
  const { isSearchModalOpen, setSearchModalOpen } = useAppStore();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (isSearchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      setQuery("");
      setResults([]);
    }
  }, [isSearchModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchModalOpen(true);
      }
      if (e.key === "Escape" && isSearchModalOpen) {
        setSearchModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchModalOpen, setSearchModalOpen]);

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
        supabase.from("items").select("id, title").ilike("title", q).limit(5),
        supabase.from("people").select("id, name").ilike("name", q).limit(5),
        supabase.from("threads").select("id, title").ilike("title", q).limit(5),
        supabase.from("explores").select("id, title").ilike("title", q).limit(5),
        supabase.from("locations").select("id, item_name, location_text").or(`item_name.ilike.${q},location_text.ilike.${q}`).limit(5)
      ]);

      const combined = [
        ...(tasks.data || []).map((t) => ({ ...t, type: "task", icon: CheckSquare, path: "/do" })),
        ...(people.data || []).map((p) => ({ ...p, title: p.name, type: "person", icon: Users, path: "/people" })),
        ...(threads.data || []).map((t) => ({ ...t, type: "thread", icon: MessageSquare, path: `/think/${t.id}` })),
        ...(explores.data || []).map((e) => ({ ...e, type: "explore", icon: Compass, path: "/explore" })),
        ...(locations.data || []).map((l) => ({ ...l, title: `${l.item_name} - ${l.location_text}`, type: "location", icon: MapPin, path: "/locations" }))
      ];

      setResults(combined);
      setLoading(false);
    }
    performSearch();
  }, [debouncedQuery, supabase]);

  if (!isSearchModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={() => setSearchModalOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-2xl bg-[rgba(11,9,20,0.95)] backdrop-blur-3xl border border-[var(--color-border)] shadow-2xl rounded-2xl overflow-hidden"
        >
          <div className="flex items-center px-4 border-b border-[var(--color-border)]">
            <Search className="w-5 h-5 text-[var(--color-text-3)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search everything..."
              className="flex-1 bg-transparent border-none text-[var(--color-text-1)] text-lg py-4 pl-4 focus:outline-none focus:ring-0 placeholder-[rgba(255,255,255,0.3)]"
            />
            {loading && <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-3)]" />}
            <button onClick={() => setSearchModalOpen(false)} className="p-2 ml-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] rounded-lg hover:bg-[var(--color-surface)] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!query && (
              <div className="p-8 text-center text-[var(--color-text-3)] text-sm">
                Type to search across tasks, people, threads, explores, and locations.
              </div>
            )}
            
            {query && !loading && results.length === 0 && (
              <div className="p-8 text-center text-[var(--color-text-3)] text-sm">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}

            {results.map((result, i) => (
              <button
                key={`${result.type}-${result.id}-${i}`}
                onClick={() => {
                  setSearchModalOpen(false);
                  router.push(result.path);
                }}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-[var(--color-surface)] text-left transition-colors group"
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
