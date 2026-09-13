"use client";
import { useContext, useEffect, useRef } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { useDebouncedCallback } from "use-debounce";
import { logger } from "@/lib/logger";
import { RealtimeContext } from "@/components/providers/RealtimeProvider";

export interface UseRealtimeOptions {
  /** An extra query key to invalidate alongside the table's default keys. */
  queryKey?: readonly unknown[];
}

/**
 * Which TanStack Query keys a change on each table should invalidate.
 * Kept here so every consumer of a table agrees on the cache contract.
 */
const TABLE_QUERY_KEYS: Record<string, string[][]> = {
  items: [["tasks"], ["inbox-tasks"], ["dashboard"]],
  people: [["people_minimal"], ["people"], ["dashboard"]],
  threads: [["threads"], ["dashboard"]],
  explores: [["explores"], ["dashboard"]],
  locations: [["locations"]],
};

/**
 * Refetch-on-change for a Supabase table.
 *
 * Subscriptions are owned by RealtimeProvider, which multiplexes every
 * consumer of a table onto one channel. This hook only registers a listener
 * and debounces the resulting invalidations; it never opens a channel itself.
 *
 * Previously this hook carried a second, complete subscription implementation
 * as a fallback for a missing provider — duplicate channel setup, a duplicate
 * echo-suppression rule reading a separate copy of the mutation timestamps,
 * and duplicate teardown. The app layout always provides the context, so that
 * path never ran in production while still shipping in every bundle and
 * drifting from the real one. Without a provider the hook is now inert.
 */
export function useRealtime(
  table: string,
  onUpdate?: () => void,
  options?: UseRealtimeOptions,
) {
  const queryClient = useContext(QueryClientContext);
  const context = useContext(RealtimeContext);

  // Keep the latest callback without resubscribing on every render.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const extraQueryKey = options?.queryKey;

  // Collapse bursts (a batch write emits one event per row) into one refetch.
  const debouncedUpdate = useDebouncedCallback(() => {
    if (queryClient) {
      for (const queryKey of TABLE_QUERY_KEYS[table] ?? []) {
        queryClient.invalidateQueries({ queryKey });
      }
      if (extraQueryKey) {
        queryClient.invalidateQueries({ queryKey: extraQueryKey });
      }
    }
    onUpdateRef.current?.();
  }, 200);

  useEffect(() => {
    if (!context) {
      if (process.env.NODE_ENV !== "production") {
        logger.warn(
          `[Realtime] useRealtime("${table}") rendered outside RealtimeProvider — live updates are off for this subtree.`,
        );
      }
      return;
    }
    return context.subscribe(table, () => debouncedUpdate());
  }, [table, context, debouncedUpdate]);
}
