"use client";
import { logger } from "@/lib/logger";
import { useEffect, useRef, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { useDebouncedCallback } from "use-debounce";

export function useRealtime(table: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const supabase = useMemo(() => createClient(), []);

  // Consolidate updates with 200ms debounce
  const debouncedUpdate = useDebouncedCallback(() => {
    logger.info(`[Realtime] Triggering debounced update for ${table}`);
    onUpdateRef.current();
  }, 200);

  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const handleVisibility = () => setIsVisible(document.visibilityState === 'visible');
    window.addEventListener('visibilitychange', handleVisibility);
    // Set initial state since window might not be defined initially in SSR
    handleVisibility();
    return () => window.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    // Create a generic subscription for INSERT, UPDATE, DELETE on the specified table
    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          // Check if we mutated locally within the last 500ms for this specific table.
          // If so, ignore this event as it's likely an echo of our own mutation.
          const lastMutations = useAppStore.getState().lastMutations || {};
          const lastMutationAt = lastMutations[table] || 0;
          if (Date.now() - lastMutationAt < 500) {
            logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
            return;
          }

          logger.info(`[Realtime] Update on ${table}:`, payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, supabase, debouncedUpdate, isVisible]);
}
