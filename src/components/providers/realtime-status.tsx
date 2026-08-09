import { createContext, useContext } from "react";

// PERF-10a: extracted from RealtimeProvider.tsx so root-layout components
// (ConnectionStatus → useRealtimeStatus) can read the connection status
// without pulling @supabase/supabase-js + zod (chunk 5967, ~77.8 KiB gz)
// into the public-route client bundle. This module must stay supabase-free.

export const RealtimeStatusContext = createContext<
  "connected" | "reconnecting" | "disconnected"
>("connected");

export function useRealtimeConnectionStatus() {
  return useContext(RealtimeStatusContext);
}
