"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { RealtimeStatusContext } from "./realtime-status";
import {
  getLastMutationTime,
  markMutation,
  resetMutationTracking,
} from "@/lib/mutation-tracking";

/**
 * How long after a local write to ignore realtime events for that table, so
 * the echo of our own change does not trigger a refetch over the optimistic UI.
 */
const ECHO_WINDOW_MS = 500;

/** Payload shape is per-table and not known statically here. */
export type RealtimePayload = RealtimePostgresChangesPayload<
  Record<string, unknown>
>;

export { markMutation, getLastMutationTime, resetMutationTracking };

type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

/** The app is only as live as its worst open channel. */
function aggregateStatus(
  statuses: Record<string, ConnectionStatus>,
): ConnectionStatus {
  const values = Object.values(statuses);
  if (values.includes("disconnected")) return "disconnected";
  if (values.includes("reconnecting")) return "reconnecting";
  return "connected";
}

export interface RealtimeContextType {
  subscribe: (
    table: string,
    callback: (payload?: RealtimePayload) => void,
  ) => () => void;
  markMutation: (table?: string) => void;
}

export const RealtimeContext = createContext<RealtimeContextType | undefined>(
  undefined,
);

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error(
      "useRealtimeContext must be used within a RealtimeProvider",
    );
  }
  return context;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<
    Record<string, Set<(payload?: RealtimePayload) => void>>
  >({});
  const channelsRef = useRef<Record<string, RealtimeChannel>>({});
  const pendingUpdatesRef = useRef<Record<string, boolean>>({});
  const teardownTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  // Per-channel status. A single shared value let the last channel to report
  // win: a teardown's CLOSED left the banner stuck on "Reconnecting…", and a
  // healthy channel's SUBSCRIBED hid another that was down.
  const channelStatusRef = useRef<Record<string, ConnectionStatus>>({});
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connected");

  const setChannelStatus = useCallback(
    (table: string, status: ConnectionStatus | null) => {
      if (status === null) {
        delete channelStatusRef.current[table];
      } else {
        channelStatusRef.current[table] = status;
      }
      setConnectionStatus(aggregateStatus(channelStatusRef.current));
    },
    [],
  );

  // Clean up all channels on unmount
  useEffect(() => {
    return () => {
      const supabase = createClient();
      Object.keys(channelsRef.current).forEach((table) => {
        const channel = channelsRef.current[table];
        if (channel) {
          logger.info(
            `[RealtimeProvider] Tearing down channel for ${table} on unmount`,
          );
          supabase.removeChannel(channel);
        }
      });
      channelsRef.current = {};
      // Clean up any pending teardown timers
      Object.values(teardownTimers.current).forEach(clearTimeout);
      teardownTimers.current = {};
    };
  }, []);

  // Handle tab visibility change: dispatch pending updates when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        logger.info(
          "[RealtimeProvider] Tab became visible, dispatching pending updates",
        );
        Object.keys(pendingUpdatesRef.current).forEach((table) => {
          if (pendingUpdatesRef.current[table]) {
            pendingUpdatesRef.current[table] = false;
            const tableListeners = listenersRef.current[table];
            if (tableListeners) {
              logger.info(
                `[RealtimeProvider] Dispatching pending updates for ${table}`,
              );
              tableListeners.forEach((callback) => callback());
            }
          }
        });
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    return () =>
      window.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const subscribeToChannel = useCallback(
    (table: string) => {
      if (channelsRef.current[table]) return;

      logger.info(`[RealtimeProvider] Subscribing to channel for ${table}`);

      let channel: RealtimeChannel;
      try {
        channel = createClient()
          .channel(`realtime_${table}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            (payload: RealtimePayload) => {
              // A local write echoes back over the socket. Refetching on our
              // own change would clobber the optimistic UI, so ignore events
              // that land immediately after one.
              if (Date.now() - getLastMutationTime(table) < ECHO_WINDOW_MS) {
                return;
              }

              if (document.visibilityState === "hidden") {
                // Buffer instead of refetching into a tab nobody is looking at;
                // flushed by the visibilitychange handler above.
                pendingUpdatesRef.current[table] = true;
                return;
              }

              listenersRef.current[table]?.forEach((callback) =>
                callback(payload),
              );
            },
          )
          .subscribe((status) => {
            // realtime-js also reports CLOSED when we remove the channel
            // ourselves. By then it is no longer registered, so ignore it.
            if (channelsRef.current[table] !== channel) return;
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setChannelStatus(table, "disconnected");
            } else if (status === "CLOSED") {
              setChannelStatus(table, "reconnecting");
            } else if (status === "SUBSCRIBED") {
              setChannelStatus(table, "connected");
            }
          });
      } catch (error) {
        // Failing to open the socket must degrade to "no live updates", never
        // take down the app tree. Queries still refetch on their own schedule
        // and ConnectionStatus tells the user the connection is down.
        logger.error(
          `[RealtimeProvider] Failed to open channel for ${table}:`,
          error,
        );
        setChannelStatus(table, "disconnected");
        return;
      }

      channelsRef.current[table] = channel;
    },
    [setChannelStatus],
  );

  const unsubscribeFromChannel = useCallback(
    (table: string) => {
      const channel = channelsRef.current[table];
      if (channel) {
        logger.info(
          `[RealtimeProvider] Unsubscribing from channel for ${table}`,
        );
        // Deregister before removing so the CLOSED this triggers is ignored.
        delete channelsRef.current[table];
        createClient().removeChannel(channel);
      }
      delete pendingUpdatesRef.current[table];
      setChannelStatus(table, null);
    },
    [setChannelStatus],
  );

  const subscribe = useCallback(
    (table: string, callback: (payload?: RealtimePayload) => void) => {
      if (!listenersRef.current[table]) {
        listenersRef.current[table] = new Set();
      }
      const tableListeners = listenersRef.current[table];
      tableListeners.add(callback);

      // When counts go 0 -> 1, subscribe
      if (tableListeners.size === 1) {
        subscribeToChannel(table);
      }

      // Cancel any pending teardown
      if (teardownTimers.current[table]) {
        clearTimeout(teardownTimers.current[table]);
        delete teardownTimers.current[table];
      }

      return () => {
        tableListeners.delete(callback);
        // When counts go 1 -> 0, delay teardown — user might navigate back
        if (tableListeners.size === 0) {
          teardownTimers.current[table] = setTimeout(() => {
            unsubscribeFromChannel(table);
            delete listenersRef.current[table];
            delete teardownTimers.current[table];
          }, 5000);
        }
      };
    },
    [subscribeToChannel, unsubscribeFromChannel],
  );

  const value = React.useMemo(() => ({ subscribe, markMutation }), [subscribe]);

  return (
    <RealtimeStatusContext.Provider value={connectionStatus}>
      <RealtimeContext.Provider value={value}>
        {children}
      </RealtimeContext.Provider>
    </RealtimeStatusContext.Provider>
  );
}
