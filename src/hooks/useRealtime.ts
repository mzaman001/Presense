"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebouncedCallback } from "use-debounce";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { logger } from "@/lib/logger";
import { useRealtimeContext } from "@/components/providers/RealtimeProvider";

export interface UseRealtimeOptions {
  queryKey?: any[];
}

export function useRealtime(
  table: string,
  onUpdate?: () => void,
  options?: UseRealtimeOptions
) {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    // Suppress error if QueryClient is not available (e.g. in standalone tests)
  }

  // Try to consume useRealtimeContext()
  let context: ReturnType<typeof useRealtimeContext> | undefined = undefined;
  try {
    context = useRealtimeContext();
  } catch (e) {
    // context is not present (fallback path for tests)
  }

  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Consolidate updates with 200ms debounce
  const debouncedUpdate = useDebouncedCallback((payload?: any) => {
    logger.info(`[Realtime] Triggering debounced update for ${table}`);

    try {
      if (queryClient) {
        const mapping: Record<string, any[][]> = {
          items: [["tasks"], ["inbox-tasks"], ["dashboard"]],
          people: [["people_minimal"], ["people"], ["dashboard"]],
          threads: [["threads"], ["dashboard"]],
          explores: [["explores"], ["dashboard"]],
          locations: [["locations"]],
        };
        const keys = mapping[table];
        if (keys) {
          keys.forEach((queryKey) => {
            queryClient!.invalidateQueries({ queryKey });
          });
        }
      }
    } catch (e) {
      // Wrap useQueryClient() and invalidation logic safely so it doesn't crash if QueryClient is not set up in tests.
    }

    if (options?.queryKey && queryClient) {
      logger.info(`[Realtime] Invalidate query key:`, options.queryKey);
      try {
        queryClient.invalidateQueries({ queryKey: options.queryKey });
      } catch (e) {}
    }

    if (onUpdateRef.current) {
      onUpdateRef.current();
    }
  }, 200);

  // Tab visibility state for fallback mode
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    if (context) return; // Only needed for fallback mode
    const handleVisibility = () => setIsVisible(document.visibilityState === "visible");
    window.addEventListener("visibilitychange", handleVisibility);
    handleVisibility();
    return () => window.removeEventListener("visibilitychange", handleVisibility);
  }, [context]);

  // 1. Context-based subscription path
  useEffect(() => {
    if (!context) return;

    logger.info(`[Realtime] Subscribing via RealtimeContext for ${table}`);
    const unsubscribe = context.subscribe(table, (payload) => {
      debouncedUpdate(payload);
    });

    return () => {
      unsubscribe();
    };
  }, [table, context, debouncedUpdate]);

  // 2. Standalone fallback path
  useEffect(() => {
    if (context) return;
    if (!isVisible) return;

    logger.warn(`[Realtime] RealtimeContext is null, falling back to standalone subscription for ${table}`);
    const supabase = createClient();
    let channel: any;
    try {
      channel = supabase
        .channel(`realtime_${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: table },
          (payload: any) => {
            const lastMutations = useAppStore.getState().lastMutations || {};
            const lastMutationAt = Math.max(lastMutations[table] || 0, lastMutations["_global"] || 0);
            if (Date.now() - lastMutationAt < 500) {
              logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
              return;
            }

            logger.info(`[Realtime] Update on ${table}:`, payload);
            debouncedUpdate(payload);
          }
        )
        .subscribe();
    } catch (e) {
      logger.error(`[Realtime] Error subscribing to channel for ${table}:`, e);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [table, context, debouncedUpdate, isVisible]);
}

