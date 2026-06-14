import { useEffect } from "react";
import { createClient } from "@/lib/supabase";

export function useRealtime(table: string, onUpdate: () => void) {
  useEffect(() => {
    const supabase = createClient();
    
    // Create a generic subscription for INSERT, UPDATE, DELETE on the specified table
    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          console.log(`Realtime update on ${table}:`, payload);
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, onUpdate]);
}
