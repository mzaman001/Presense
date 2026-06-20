import { useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";

export function useRealtime(table: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    
    // Create a generic subscription for INSERT, UPDATE, DELETE on the specified table
    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          // Check if we mutated locally within the last 2.5 seconds.
          // If so, ignore this event as it's likely an echo of our own mutation,
          // which prevents the UI from flickering back to an old state before the fetch completes.
          const lastMutationAt = useAppStore.getState().lastMutationAt;
          if (Date.now() - lastMutationAt < 2500) {
            console.log(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
            return;
          }

          console.log(`[Realtime] Update on ${table}:`, payload);
          onUpdateRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, supabase]);
}
