"use client";
import { useState, useEffect } from "react";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export function useRealtimeStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connected");

  useEffect(() => {
    const handleOnline = () => setStatus("connected");
    const handleOffline = () => setStatus("disconnected");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}
