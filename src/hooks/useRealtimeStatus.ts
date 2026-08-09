"use client";
import { useRealtimeConnectionStatus } from "@/components/providers/realtime-status";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export function useRealtimeStatus(): ConnectionStatus {
  return useRealtimeConnectionStatus();
}
