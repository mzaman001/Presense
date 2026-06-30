"use client";

import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

let lastMutations: Record<string, number> = {};

export function markMutation(table?: string) {
  const now = Date.now();
  if (table) {
    lastMutations[table] = now;
  } else {
    lastMutations["_global"] = now;
  }
}

export function getLastMutationTime(table: string): number {
  return Math.max(lastMutations[table] || 0, lastMutations["_global"] || 0);
}

export interface RealtimeContextType {
  subscribe: (table: string, callback: (payload?: any) => void) => () => void;
  markMutation: (table?: string) => void;
}

export const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error("useRealtimeContext must be used within a RealtimeProvider");
  }
  return context;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Record<string, Set<(payload?: any) => void>>>({});
  const channelsRef = useRef<Record<string, any>>({});
  const pendingUpdatesRef = useRef<Record<string, boolean>>({});

  // Clean up all channels on unmount
  useEffect(() => {
    return () => {
      const supabase = createClient();
      Object.keys(channelsRef.current).forEach((table) => {
        const channel = channelsRef.current[table];
        if (channel) {
          logger.info(`[RealtimeProvider] Tearing down channel for ${table} on unmount`);
          supabase.removeChannel(channel);
        }
      });
      channelsRef.current = {};
    };
  }, []);

  // Handle tab visibility change: dispatch pending updates when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        logger.info("[RealtimeProvider] Tab became visible, dispatching pending updates");
        Object.keys(pendingUpdatesRef.current).forEach((table) => {
          if (pendingUpdatesRef.current[table]) {
            pendingUpdatesRef.current[table] = false;
            const tableListeners = listenersRef.current[table];
            if (tableListeners) {
              logger.info(`[RealtimeProvider] Dispatching pending updates for ${table}`);
              tableListeners.forEach((callback) => callback());
            }
          }
        });
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    return () => window.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const subscribeToChannel = useCallback((table: string) => {
    if (channelsRef.current[table]) return;

    logger.info(`[RealtimeProvider] Subscribing to channel for ${table}`);
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: table },
        (payload) => {
          // Hoisted echo lockout guard: check getLastMutationTime
          if (Date.now() - getLastMutationTime(table) < 500) {
            logger.info(`[RealtimeProvider] Ignoring echo on ${table} due to recent local mutation`);
            return;
          }

          logger.info(`[RealtimeProvider] Update on ${table}:`, payload);

          if (document.visibilityState === "hidden") {
            logger.info(`[RealtimeProvider] Tab hidden, buffering update for ${table}`);
            pendingUpdatesRef.current[table] = true;
          } else {
            const tableListeners = listenersRef.current[table];
            if (tableListeners) {
              tableListeners.forEach((callback) => callback(payload));
            }
          }
        }
      )
      .subscribe();

    channelsRef.current[table] = channel;
  }, []);

  const unsubscribeFromChannel = useCallback((table: string) => {
    const channel = channelsRef.current[table];
    if (channel) {
      logger.info(`[RealtimeProvider] Unsubscribing from channel for ${table}`);
      const supabase = createClient();
      supabase.removeChannel(channel);
      delete channelsRef.current[table];
    }
    delete pendingUpdatesRef.current[table];
  }, []);

  const subscribe = useCallback((table: string, callback: (payload?: any) => void) => {
    if (!listenersRef.current[table]) {
      listenersRef.current[table] = new Set();
    }
    const tableListeners = listenersRef.current[table];
    tableListeners.add(callback);

    // When counts go 0 -> 1, subscribe
    if (tableListeners.size === 1) {
      subscribeToChannel(table);
    }

    return () => {
      tableListeners.delete(callback);
      // When counts go 1 -> 0, unsubscribe
      if (tableListeners.size === 0) {
        unsubscribeFromChannel(table);
        delete listenersRef.current[table];
      }
    };
  }, [subscribeToChannel, unsubscribeFromChannel]);

  const value = React.useMemo(() => ({ subscribe, markMutation }), [subscribe]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
