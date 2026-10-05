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
 * matches. In the browser it keeps the server's time until the minute moves
 * past it, then follows the minute; the zone becomes `timeZone` (the same
 * as the server's unless the device has moved). Switching straight to the
 * current minute made React re-render the whole list right after hydration
 * (a ~90 ms "cascading update" on a phone) for a time that grouped nothing
 * differently.
 */
export function useLiveClock(initial: Required<Clock>, timeZone: () => string) {
  const now = useSyncExternalStore(
    subscribeMinute,
    () => Math.max(initial.now, currentMinute()),
    () => initial.now,
  );
  const zone = useSyncExternalStore(
    noSubscription,
    timeZone,
    () => initial.timeZone,
  );
  return { timeZone: zone, now };
}
