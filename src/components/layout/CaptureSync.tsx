"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useUserId } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase";
import {
  STUCK_AFTER_ATTEMPTS,
  flushOutbox,
  invalidateForCaptures,
  readOutbox,
  subscribeOutbox,
} from "@/lib/capture-outbox";
import { Icon as UiIcon } from "@/components/ui/Icon";

/** While anything is waiting, try again this often. */
const RETRY_MS = 30_000;

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * Sends captures that were saved on this device but haven't reached the
 * database yet: on load, when the connection returns, when the tab comes
 * back into view, and every 30s while any are waiting. Shows a small pill
 * while something is waiting, so "saved" is never a silent promise.
 */
export function CaptureSync() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  // A string snapshot: readOutbox returns a new array on every call.
  const snapshot = useSyncExternalStore(
    subscribeOutbox,
    () => {
      const entries = readOutbox(userId);
      const failed = entries.filter((e) => e.attempts > 0).length;
      const stuck = entries.filter(
        (e) => e.attempts >= STUCK_AFTER_ATTEMPTS,
      ).length;
      return `${entries.length}:${failed}:${stuck}`;
    },
    () => "0:0:0",
  );
  const [pending, failed, stuck] = snapshot.split(":").map(Number);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  const sync = useCallback(async () => {
    if (!userId || readOutbox(userId).length === 0) return;
    const { synced } = await flushOutbox(supabase, userId);
    if (synced.length === 0) return;
    invalidateForCaptures(queryClient, synced);
    // Only announce captures that had to wait; a normal save already
    // said "Saved" when it was taken.
    const late = synced.filter((c) => c.attempts > 0).length;
    if (late > 0) {
      toast.success(
        late === 1 ? "Your capture synced" : `${late} captures synced`,
      );
    }
  }, [supabase, userId, queryClient]);

  useEffect(() => {
    if (pending > 0 && online) void sync();
  }, [pending, online, sync]);

  useEffect(() => {
    if (pending === 0) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void sync(), RETRY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [pending, sync]);

  // A normal online save lands in well under a second; flashing a pill for
  // it would be noise. Show it only when a capture is actually waiting.
  if (pending === 0 || (online && failed === 0)) return null;

  const label = !online
    ? `Offline · ${pending === 1 ? "1 capture" : `${pending} captures`} saved on this device`
    : stuck > 0
      ? `${stuck === 1 ? "1 capture hasn't" : `${stuck} captures haven't`} synced yet`
      : `Saved on this device · syncing ${pending === 1 ? "1 capture" : `${pending} captures`}…`;

  return (
    <div
      role="status"
      className="fixed bottom-[calc(var(--mobile-bottom-nav-h)+env(safe-area-inset-bottom,0px)+var(--space-3))] left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] py-1.5 pr-1.5 pl-3 text-[length:var(--text-ui)] text-[var(--text-2)] shadow-[var(--shadow-md)] md:bottom-6"
    >
      <UiIcon
        className="h-3.5 w-3.5 shrink-0 text-[var(--text-3)]"
        icon={online ? RefreshCw : CloudOff}
      />
      <span>{label}</span>
      {online && stuck > 0 ? (
        <button
          type="button"
          onClick={() => void sync()}
          className="rounded-full px-2.5 py-1 font-medium text-[var(--accent-text)] hover:bg-[var(--accent-dim)]"
        >
          Retry
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </div>
  );
}
