# Phase 2 Codebase Exploration & Design Recommendations Report

This report summarizes findings from the codebase exploration of the realtime system, Zustand store, TanStack Query provider, and Supabase client configuration, and provides design recommendations for implementing the centralized `RealtimeProvider` and refactoring the `useRealtime` hook.

---

## 1. Observation

### A. Current `useRealtime` Hook Implementation
The hook is defined in `src/hooks/useRealtime.ts` (Lines 8-62):
```typescript
export function useRealtime(table: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const supabase = useMemo(() => createClient(), []);

  // Consolidate updates with 200ms debounce
  const debouncedUpdate = useDebouncedCallback(() => {
    logger.info(`[Realtime] Triggering debounced update for ${table}`);
    onUpdateRef.current();
  }, 200);

  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const handleVisibility = () => setIsVisible(document.visibilityState === 'visible');
    window.addEventListener('visibilitychange', handleVisibility);
    // Set initial state since window might not be defined initially in SSR
    handleVisibility();
    return () => window.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    // Create a generic subscription for INSERT, UPDATE, DELETE on the specified table
    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          // Check if we mutated locally within the last 500ms for this specific table.
          const lastMutations = useAppStore.getState().lastMutations || {};
          const lastMutationAt = Math.max(lastMutations[table] || 0, lastMutations['_global'] || 0);
          if (Date.now() - lastMutationAt < 500) {
            logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
            return;
          }

          logger.info(`[Realtime] Update on ${table}:`, payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, supabase, debouncedUpdate, isVisible]);
}
```
**Key Observations:**
* **Client Creation**: Each instance of the hook calls `createClient()` inside `useMemo` (Line 15).
* **Visibility Handling**: If `isVisible` is false, the hook returns early. In the cleanup function of `useEffect` (Line 58), `supabase.removeChannel(channel)` is executed. This tears down the channel when the tab becomes invisible and resubscribes when it becomes visible.
* **Echo Lockout Guard**: Checks `lastMutations[table]` and `lastMutations['_global']` from `useAppStore` to reject events within 500ms of local mutations (Lines 45-50).

---

### B. Usages of `useRealtime` in the Project
We identified **14 distinct usages** of `useRealtime` across 9 page files and 5 tables:

| Subscribed Table | File Location | Callback / Action | Purpose |
|---|---|---|---|
| **items** | `src/app/(app)/do/page.tsx:191` | `fetchTasks` | Refetches active/overdue tasks |
| **people** | `src/app/(app)/do/page.tsx:192` | `fetchPeopleList` | Refetches minimal people list |
| **explores** | `src/app/(app)/explore/page.tsx:168` | `fetchItems` | Refetches explore grid items |
| **items** | `src/app/(app)/inbox/page.tsx:165` | `refetch` | Refetches inbox items |
| **locations** | `src/app/(app)/remember/locations/page.tsx:57` | `fetchItems` | Refetches locations list |
| **people** | `src/app/(app)/remember/people/[id]/page.tsx:102` | `fetchPerson` | Refetches specific person profile & details |
| **items** | `src/app/(app)/remember/people/[id]/page.tsx:103` | `fetchPerson` | Refetches specific person's related items |
| **people** | `src/app/(app)/remember/people/page.tsx:250` | `fetchPeople` | Refetches main people list |
| **threads** | `src/app/(app)/think/[id]/page.tsx:168` | `fetchThread` | Refetches thread info & messages |
| **explores** | `src/app/(app)/think/[id]/page.tsx:169` | `fetchThread` | Refetches related explore items inside thread |
| **threads** | `src/app/(app)/think/page.tsx:64` | `fetchThreads` | Refetches threads list |
| **items** | `src/app/(app)/page.tsx:232` | `refreshData` | Refetches dashboard active tasks |
| **people** | `src/app/(app)/page.tsx:233` | `refreshData` | Refetches dashboard contact profiles |
| **threads** | `src/app/(app)/page.tsx:234` | `refreshData` | Refetches dashboard active threads |
| **explores** | `src/app/(app)/page.tsx:235` | `refreshData` | Refetches dashboard explore log |

All usages follow the same pattern: passing a table string and a callback function that wraps a React Query `refetch` or custom fetch function.

---

### C. TanStack Query Configuration
The query client provider is structured in `src/components/layout/QueryProvider.tsx`:
```typescript
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```
**Key Observations:**
* The provider is used in `src/app/(app)/layout.tsx` (Lines 39-50) and wraps the main app page tree.
* Default stale time is set to 5 minutes, and `refetchOnWindowFocus` is enabled.

---

### D. `useAppStore` Implementation & `markMutation` Usages
Defined in `src/store/useAppStore.ts` (Lines 64-65, 91-97):
```typescript
interface AppState {
  ...
  lastMutations: Record<string, number>;
  markMutation: (table?: string) => void;
  ...
}

export const useAppStore = create<AppState>((set) => ({
  ...
  lastMutations: {},
  markMutation: (table) => set((state) => {
    const now = Date.now();
    return {
      lastMutations: { ...state.lastMutations, [table || '_global']: now },
    };
  }),
  ...
}));
```
**Key Observations:**
* `markMutation` stores timestamps on a per-table basis (using table name as key) or fallback `_global` key when called without arguments.
* `markMutation` is called across the codebase right before/after mutations in:
  - `src/components/features/TaskCard.tsx` (task updates, toggles)
  - `src/components/features/TaskAddPanel.tsx` (new task creations)
  - `src/components/features/RitualOverlay.tsx` (ritual updates, items, threads)
  - `src/components/features/PomodoroTimer.tsx` (logging sessions)
  - `src/components/features/calendar/CalendarView.tsx` (rescheduling items)

---

### E. Supabase Client Initialization
Defined in `src/lib/supabase.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```
**Key Observations:**
* Calling `createClient()` repeatedly constructs a brand-new instance of `SupabaseClient` via `createBrowserClient` each time, which wastes resources and prevents connection reuse.

---

## 2. Logic Chain

1. **Tab Visibility Inefficiencies**: When the browser tab is hidden, the current hook tears down the subscription (`supabase.removeChannel(channel)`). When the tab is refocused, the hook recreates the subscription. This teardown-rebuild cycle introduces WebSocket connection overhead, latency, and increases the window for missed events. By keeping the WebSocket connection active in a centralized provider but queuing/deferring updates, we can avoid socket churn while ensuring the UI is safely updated once the tab returns to focus.
2. **Supabase Client Proliferation**: Currently, every single call to `useRealtime` calls `createClient()` and generates a new client instance. If a page like the Dashboard subscribes to 4 tables, it instantiates 4 clients. Centralizing the Supabase client inside the provider or converting `supabase.ts` into a client-side singleton is critical to reuse a single WebSocket connection.
3. **Redundant Channel Subscriptions**: When multiple components subscribe to the same table (e.g. `items` in both task list and calendar card), they create duplicate realtime channels. Reference counting inside a single `RealtimeProvider` can multiplex listeners over a single connection/channel per table, drastically reducing the load on the database.
4. **Centralized Echo Guard Hoisting**: Checking if a change event is an echo (initiated locally within 500ms) is currently done independently in each hook. Since the provider receives the event first, hoisting the echo guard into the provider allows filtering out echoes *before* distributing them to hook listeners, reducing CPU and store-read overhead.
5. **Ensuring Test suite Backward Compatibility**: The existing test suite in `src/lib/__tests__/phase4.test.tsx` mounts components like `TestRealtimeComponent` that use `useRealtime` without wrapping them in the `RealtimeProvider`. If the hook is refactored to throw when context is missing, the test suite will break. To prevent this, the hook must fall back to the standalone channel subscription when `useContext(RealtimeContext)` returns null.

---

## 3. Caveats

* **Pre-existing Test Suite Configuration Issues**: Running the `phase4.test.tsx` test suite results in 31 passing tests and 19 failed tests (out of 50 total). Importantly, **all 10 core realtime hook tests** under `R1: useRealtime Hook Debouncing & Lockouts` and related cross-feature combinations pass successfully. The 19 failures are unrelated to the realtime hook; they are caused by:
  - Missing `@testing-library/jest-dom` matcher configurations in Vitest (`vitest.config.ts`), leading to `Error: Invalid Chai property: toBeInTheDocument`.
  - Unhandled promise rejections due to incomplete `supabase.auth.getUser()` mock resolution in the component-rendering tests (e.g. `RitualOverlay` and `TaskAddPanel`).
* **E2E Playwright Tests**: While the codebase contains `vitest` unit/integration tests, it does not currently have Playwright E2E tests for tab visibility simulation. Standardizing validation will require building visual/networking mocks or relying on standard test setups.
* **Supabase ssr Singleton Behavior**: `@supabase/ssr`'s `createBrowserClient` is intended to be cached, but if custom headers or parameters are dynamically injected in other parts of the application, standard singletons might need care. We assume a simple singleton cache is safe as the project only uses standard config.

---

## 4. Conclusion

We propose the following design for the centralized realtime architecture:

### A. Singleton Supabase Client Optimization (`src/lib/supabase.ts`)
```typescript
import { createBrowserClient } from '@supabase/ssr';

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  
  if (!clientInstance) {
    clientInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return clientInstance;
}
```

### B. Centralized RealtimeProvider Design (`src/components/providers/RealtimeProvider.tsx`)
```typescript
"use client";

import React, { createContext, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { logger } from "@/lib/logger";
import { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeContextType {
  subscribe: (table: string, callback: () => void) => () => void;
}

export const RealtimeContext = createContext<RealtimeContextType | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => createClient(), []);
  
  // Track active listeners per table
  const listeners = useRef<Record<string, Set<() => void>>>({});
  // Track reference count of active subscriptions per table
  const subCounts = useRef<Record<string, number>>({});
  // Track active Supabase channels
  const channels = useRef<Record<string, RealtimeChannel>>({});
  // Track tables that received updates while tab was hidden
  const pendingUpdates = useRef<Record<string, boolean>>({});

  // Dispatch helper
  const dispatchUpdate = (table: string) => {
    const tableListeners = listeners.current[table];
    if (tableListeners) {
      tableListeners.forEach((callback) => callback());
    }
  };

  // Centralized postgres_changes subscription setup
  const setupChannel = (table: string) => {
    if (channels.current[table]) return;

    logger.info(`[RealtimeProvider] Subscribing to channel for table: ${table}`);
    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: table },
        (payload) => {
          // Centralized Echo Guard Lockout
          const lastMutations = useAppStore.getState().lastMutations || {};
          const lastMutationAt = Math.max(lastMutations[table] || 0, lastMutations["_global"] || 0);
          if (Date.now() - lastMutationAt < 500) {
            logger.info(`[RealtimeProvider] Ignoring echo on ${table} due to recent local mutation`);
            return;
          }

          logger.info(`[RealtimeProvider] Received update for ${table}`, payload);

          if (document.visibilityState === "visible") {
            dispatchUpdate(table);
          } else {
            logger.info(`[RealtimeProvider] Tab hidden. Deferring update for ${table}`);
            pendingUpdates.current[table] = true;
          }
        }
      )
      .subscribe();

    channels.current[table] = channel;
  };

  // Centralized unsubscribe
  const teardownChannel = (table: string) => {
    const channel = channels.current[table];
    if (channel) {
      logger.info(`[RealtimeProvider] Removing channel for table: ${table}`);
      supabase.removeChannel(channel);
      delete channels.current[table];
      delete pendingUpdates.current[table];
    }
  };

  const subscribe = (table: string, callback: () => void) => {
    if (!listeners.current[table]) {
      listeners.current[table] = new Set();
    }
    listeners.current[table].add(callback);

    subCounts.current[table] = (subCounts.current[table] || 0) + 1;
    if (subCounts.current[table] === 1) {
      setupChannel(table);
    }

    return () => {
      listeners.current[table]?.delete(callback);
      subCounts.current[table] = (subCounts.current[table] || 0) - 1;

      if (subCounts.current[table] === 0) {
        teardownChannel(table);
      }
    };
  };

  // Tab visibility change handling
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        logger.info("[RealtimeProvider] Tab visible. Processing deferred updates:", pendingUpdates.current);
        Object.keys(pendingUpdates.current).forEach((table) => {
          if (pendingUpdates.current[table]) {
            dispatchUpdate(table);
            pendingUpdates.current[table] = false;
          }
        });
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);
    return () => window.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return (
    <RealtimeContext.Provider value={{ subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}
```

### C. Refactored `useRealtime` Hook Design (`src/hooks/useRealtime.ts`)
```typescript
"use client";

import { useEffect, useRef, useContext } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useQueryClient, QueryKey } from "@tanstack/react-query";
import { RealtimeContext } from "@/components/providers/RealtimeProvider";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { logger } from "@/lib/logger";

interface UseRealtimeOptions {
  onUpdate?: () => void;
  queryKeys?: QueryKey[];
}

export function useRealtime(
  table: string,
  onUpdateOrOptions?: (() => void) | UseRealtimeOptions,
  queryKeysOption?: QueryKey[]
) {
  const queryClient = useQueryClient();
  const context = useContext(RealtimeContext);

  // Normalize options for backward compatibility
  let onUpdate: (() => void) | undefined;
  let queryKeys: QueryKey[] | undefined;

  if (typeof onUpdateOrOptions === "function") {
    onUpdate = onUpdateOrOptions;
    queryKeys = queryKeysOption;
  } else if (onUpdateOrOptions) {
    onUpdate = onUpdateOrOptions.onUpdate;
    queryKeys = onUpdateOrOptions.queryKeys;
  }

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Debounced callback (200ms)
  const debouncedUpdate = useDebouncedCallback(() => {
    logger.info(`[useRealtime] Executing update logic for table: ${table}`);
    
    // 1. Invalidate TanStack Query keys if specified
    if (queryKeys && queryKeys.length > 0) {
      queryKeys.forEach((key) => {
        logger.info(`[useRealtime] Invalidating query:`, key);
        queryClient.invalidateQueries({ queryKey: key });
      });
    }

    // 2. Trigger custom callback if specified
    if (onUpdateRef.current) {
      onUpdateRef.current();
    }
  }, 200);

  useEffect(() => {
    if (context) {
      // Consume context from RealtimeProvider
      return context.subscribe(table, debouncedUpdate);
    } else {
      // Fallback path to ensure tests pass in environments lacking a RealtimeProvider
      logger.warn(`[useRealtime] RealtimeProvider context not found. Falling back to standalone channel for ${table}.`);
      
      const supabase = createClient();
      const channel = supabase
        .channel(`realtime_fallback_${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: table },
          () => {
            const lastMutations = useAppStore.getState().lastMutations || {};
            const lastMutationAt = Math.max(lastMutations[table] || 0, lastMutations["_global"] || 0);
            if (Date.now() - lastMutationAt < 500) {
              return;
            }
            debouncedUpdate();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [table, context, debouncedUpdate]);
}
```

---

## 5. Verification Method

### A. Automated Verification via Targeted Test Suite
Execute the Vitest test runner targeting only the realtime test suite to verify baseline compatibility:
```powershell
npx vitest run src/lib/__tests__/phase4.test.tsx
```
**Invalidation Conditions**: Any test failures in `src/lib/__tests__/phase4.test.tsx` (especially the lockouts, debouncing, and table switching tests) indicate a failure in the fallback path or contract compatibility.

### B. Verification of WebSocket Singleton & Re-use
1. Open browser developer tools and go to the Network tab -> WS (WebSockets).
2. Reload the application.
3. **Expectation**: Only **one** WebSocket connection is established to the Supabase Realtime endpoint.

### C. Tab Visibility Change Verification
1. Open the application.
2. In browser developer tools, monitor WebSocket messages.
3. Switch to another browser tab (hiding the application) and make a mutation from another device/browser.
4. **Expectation**:
   - The WebSocket connection is **not** disconnected.
   - The UI does **not** update or re-fetch immediately.
5. Switch back to the application tab.
6. **Expectation**:
   - The UI immediately performs a batch refetch/query invalidation for the table that received updates.
