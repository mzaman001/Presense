import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { routeCapture, type RoutedItem } from "@/lib/capture-router";
import {
  enqueueCapture,
  flushOutbox,
  invalidateForCaptures,
} from "@/lib/capture-outbox";
import { logger } from "@/lib/logger";

/**
 * Sorts one line of text into Do / Think / Remember / Inbox and saves it
 * through the zero-loss outbox, exactly as Quick Capture does. Used where
 * text is captured without the Quick Capture preview (the ritual sweeps).
 *
 * If sorting fails, the exact words go to Inbox rather than being lost.
 * Returns what the text became, for the caller to show.
 */
export async function captureText(
  text: string,
  {
    userId,
    userSettings,
    supabase,
    queryClient,
  }: {
    userId: string;
    userSettings: Parameters<typeof routeCapture>[1];
    supabase: SupabaseClient<Database>;
    queryClient: QueryClient;
  },
): Promise<RoutedItem[]> {
  const trimmed = text.trim();
  let items: RoutedItem[];
  try {
    items = await routeCapture(trimmed, userSettings || {});
  } catch (e) {
    logger.warn("[capture] routing failed, saving to Inbox:", e);
    items = [
      {
        type: "unknown",
        title: trimmed,
        destination: "Inbox",
        destinationId: "inbox",
        confidence: 0.1,
        reason: "route_request_failed",
      },
    ];
  }
  enqueueCapture(userId, trimmed, items);
  void flushOutbox(supabase, userId).then(({ synced }) => {
    if (synced.length) invalidateForCaptures(queryClient, synced);
  });
  return items;
}
