"use client";
import { useRealtimeConnectionStatus } from "@/components/providers/RealtimeProvider";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export function useRealtimeStatus(): ConnectionStatus {
  return useRealtimeConnectionStatus();
}
