"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Clock } from "@/lib/do-buckets";

const MINUTE_MS = 60_000;

const DisplayClockContext = createContext<Clock | null>(null);

/** The timezone and moment a list of tasks is drawn for. */
export function DisplayClockProvider({
  clock,
  children,
}: {
  clock: Clock;
  children: ReactNode;
}) {
  return (
    <DisplayClockContext.Provider value={clock}>
      {children}
    </DisplayClockContext.Provider>
  );
}

// One shared minute tick for every live clock.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribeMinute(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach((l) => l()), MINUTE_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
const noSubscription = () => () => {};

/**
 * The clock a task card is drawn with: its list's, or outside a list the
 * device's zone and the current minute.
 */
export function useDisplayClock(): Clock {
  const clock = useContext(DisplayClockContext);
  // Inside a provider the list owns the clock: no minute subscription here.
  const now = useSyncExternalStore(
    clock ? noSubscription : subscribeMinute,
    currentMinute,
    currentMinute,
  );
  return clock ?? { now };
}

/**
 * The clock for a server-rendered list. The server and the hydrating render
 * both use `initial` (the server's timezone and request time), so the HTML
 * matches; right after hydration it moves to `timeZone` and the current
 * minute, and then follows the minute.
 */
export function useLiveClock(initial: Required<Clock>, timeZone: () => string) {
  const now = useSyncExternalStore(
    subscribeMinute,
    currentMinute,
    () => initial.now,
  );
  const zone = useSyncExternalStore(
    noSubscription,
    timeZone,
    () => initial.timeZone,
  );
  return { timeZone: zone, now };
}
