"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useUserId } from "@/components/providers/SessionProvider";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/shallow"; // PERF-14: partial subscription
import { createClient } from "@/lib/supabase";
import {
  Search,
  X,
  Loader2,
  CheckSquare,
  Users,
  MessageSquare,
  Compass,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import { cn, escapeFilterValue, ilikeContains } from "@/lib/utils";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { ModalErrorBoundary } from "@/components/ui/ModalErrorBoundary";
import { Sheet } from "@/components/ui/Sheet";
import { useHaptics } from "@/hooks/useHaptics";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface SearchResult {
  id: string;
  title: string;
  type: "task" | "person" | "thread" | "explore" | "location";
  icon: React.ElementType;
  path: string;
}

export function SearchModal() {
  const userId = useUserId();
  const { isSearchModalOpen, setSearchModalOpen } = useAppStore(
    useShallow((s) => ({
      isSearchModalOpen: s.isSearchModalOpen,
      setSearchModalOpen: s.setSearchModalOpen,
    })),
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const dialogRef = useDialogFocus(isSearchModalOpen);
  const haptics = useHaptics();

  // Mounted only while open, so there is no closed state to reset — just
  // move focus into the field once.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    haptics.selection();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function performSearch() {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      // INFRA-18: explicit user_id filter for planner index usage.
      const q = ilikeContains(debouncedQuery);
      const tagTerm = escapeFilterValue(`{${debouncedQuery}}`);
      const [tasks, people, threads, explores, locations] = await Promise.all([
        supabase
          .from("items")
          .select("id, title")
          .eq("user_id", userId)
          .or(`title.ilike.${q},category.ilike.${q}`)
          .limit(5),
        supabase
          .from("people")
          .select("id, name")
          .eq("user_id", userId)
          .or(`name.ilike.${q},relationship.ilike.${q}`)
          .limit(5),
        supabase
          .from("threads")
          .select("id, title")
          .eq("user_id", userId)
          .or(`title.ilike.${q}`)
          .limit(5),
        supabase
          .from("explores")
          .select("id, title")
          .eq("user_id", userId)
          .or(`title.ilike.${q},tags.cs.${tagTerm}`)
          .limit(5),
        supabase
          .from("locations")
          .select("id, item_name, location_text")
          .eq("user_id", userId)
          .or(`item_name.ilike.${q},location_text.ilike.${q}`)
          .limit(5),
      ]);

      // Surface a failing search instead of silently showing "No results".
      for (const result of [tasks, people, threads, explores, locations]) {
        if (result.error) throw result.error;
      }

      const combined: SearchResult[] = [
        ...(tasks.data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          type: "task" as const,
          icon: CheckSquare,
          path: "/do",
        })),
        ...(people.data ?? []).map((p) => ({
          id: p.id,
          title: p.name,
          type: "person" as const,
          icon: Users,
          // Person search results route to the People list, not the
          // generic "go to Remember" destination (which now correctly
          // points at /remember/locations elsewhere in the codebase).
          // People's pages are still a real, reachable space until a
          // separate, later rollout step removes them.
          path: "/remember/people",
        })),
        ...(threads.data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          type: "thread" as const,
          icon: MessageSquare,
          path: `/think/${t.id}`,
        })),
        ...(explores.data ?? []).map((e) => ({
          id: e.id,
          title: e.title,
          type: "explore" as const,
          icon: Compass,
          path: "/explore",
        })),
        ...(locations.data ?? []).map((l) => ({
          id: l.id,
          title: `${l.item_name} - ${l.location_text}`,
          type: "location" as const,
          icon: MapPin,
          path: "/remember/locations",
        })),
      ];

      setResults(combined);
      setLoading(false);
      setSelectedIndex(0);
    }
    performSearch();
  }, [debouncedQuery, supabase]);

  if (!isSearchModalOpen) return null;

  return (
    <ModalErrorBoundary
      modalName="Search Modal"
      onClose={() => setSearchModalOpen(false)}
    >
      <Sheet
        isOpen={isSearchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      >
        <div className="relative mx-auto w-full max-w-2xl overflow-hidden">
          <div className="flex items-center border-b border-[var(--color-border)] px-4">
            <UiIcon
              size={13}
              strokeWidth={1.5}
              className="ml-2 text-[var(--text-3)]"
              icon={Search}
            />
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
              className="flex-1 border-none bg-transparent py-4 pl-4 text-lg text-[var(--color-text-1)] placeholder-[rgba(255,255,255,0.3)] focus:ring-0 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="mr-1 ml-1 rounded-lg p-2 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
              >
                <UiIcon className="h-4 w-4" icon={X} />
              </button>
            )}
            {loading && (
              <UiIcon
                className="h-5 w-5 animate-spin text-[var(--color-text-3)]"
                icon={Loader2}
              />
            )}
            <div className="mx-1 h-6 w-px bg-[var(--color-border)]"></div>
            <button
              onClick={() => setSearchModalOpen(false)}
              aria-label="Close search modal"
              className="ml-1 rounded-lg p-2 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
            >
              <span className="text-caption mr-1 hidden rounded border border-[rgba(255,255,255,0.2)] px-1 font-mono sm:inline-block">
                ESC
              </span>
              <UiIcon className="hidden h-5 w-5" icon={X} />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!query && (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.03)]">
                  <UiIcon
                    className="h-6 w-6 text-[var(--color-text-3)]"
                    icon={Search}
                  />
                </div>
                <h3 className="mb-2 font-medium text-[var(--color-text-1)]">
                  Search your brain
                </h3>
                <p className="max-w-[250px] text-sm text-[var(--color-text-3)]">
                  Type to search across tasks, people, threads, explores, and
                  locations.
                </p>
              </div>
            )}

            {query && !loading && results.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.03)]">
                  <UiIcon
                    className="h-6 w-6 text-[var(--color-text-3)]"
                    icon={AlertCircle}
                  />
                </div>
                <h3 className="mb-2 font-medium text-[var(--color-text-1)]">
                  No results
                </h3>
                <p className="text-sm text-[var(--color-text-3)]">
                  No results found for &ldquo;{query}&rdquo;
                </p>
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
                  "group flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors",
                  i === selectedIndex
                    ? "bg-[var(--color-surface)] text-[var(--color-text-1)]"
                    : "text-[var(--color-text-1)] hover:bg-[var(--color-surface)]",
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] text-[var(--color-text-3)] transition-colors group-hover:bg-[var(--color-surface)] group-hover:text-[var(--color-text-1)]">
                  <result.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--color-text-1)]">
                    {result.title}
                  </div>
                  <div className="text-xs text-[var(--color-text-3)] capitalize">
                    {result.type}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-3)]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5">
                  ↑
                </kbd>
                <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5">
                  ↓
                </kbd>{" "}
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5">
                  Enter
                </kbd>{" "}
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5">
                Esc
              </kbd>{" "}
              to close
            </span>
          </div>
        </div>
      </Sheet>
    </ModalErrorBoundary>
  );
}
