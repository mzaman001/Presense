# Codebase Exploration and Design Analysis (Milestones B2, B3, B4)

## Summary of Findings

1. **`RealtimeProvider` Implementation (`src/components/providers/RealtimeProvider.tsx`)**
   - Keeps a centralized registry of active Supabase channel subscriptions using `channelsRef`.
   - Tracks listener counts using `listenersRef` (a Record mapping tables to a Set of callback functions). When listeners grow from `0 -> 1`, it establishes a channel subscription; when they shrink to `1 -> 0`, it cleans up the channel.
   - Ensures channels are not torn down on visibility changes (visibility changes only trigger buffering/flushing of updates, keeping subscriptions alive).
   - Hoists the echo guard checking `useAppStore.lastMutations` to discard incoming updates within 500ms of local mutations.
   - **Crucial Gap**: `useRealtimeContext()` currently returns `useContext(RealtimeContext)` which defaults to `null` if outside the provider. However, the test `RealtimeProvider.test.tsx` expects `useRealtimeContext` to throw an error with the message `"useRealtimeContext must be used within a RealtimeProvider"` if used outside.

2. **`useRealtime` Hook Refactoring (`src/hooks/useRealtime.ts`)**
   - Must consume the centralized subscriptions from `RealtimeProvider` when available, falling back to direct subscriptions when unavailable (such as in tests).
   - Must invalidate appropriate query cache keys via React Query's `queryClient.invalidateQueries` when database changes occur:
     - `items` -> `["tasks"]`, `["inbox-tasks"]`, `["dashboard"]`
     - `people` -> `["people_minimal"]`, `["dashboard"]`
     - `threads` -> `["dashboard"]`
     - `explores` -> `["dashboard"]`
   - Must avoid calling `useRealtimeContext()` directly if it throws on null context, since calling hooks in a try-catch is a React violation and would abort the render. Instead, it must call `useContext(RealtimeContext)` directly. This retrieves the context safely, returning `null` if the provider is missing, allowing a clean fallback.

3. **Layout Integration (`src/app/(app)/layout.tsx`)**
   - The application is already correctly structured with `RealtimeProvider` wrapped inside `QueryProvider` inside `MotionProvider`. Since `useRealtime` needs access to the query client and the realtime context, this nesting is correct.

4. **Unit and Integration Test Suites (`src/lib/__tests__/phase4.test.tsx`, `RealtimeProvider.test.tsx`)**
   - `phase4.test.tsx` runs tests with a `QueryClientProvider` but without wrapping the test components in `RealtimeProvider`.
   - Implementing the fallback in `useRealtime.ts` guarantees that all tests in `phase4.test.tsx` run in fallback mode and continue to pass with no modifications required.
   - Adding an explicit `null` check throwing `"useRealtimeContext must be used within a RealtimeProvider"` in `useRealtimeContext` ensures that `RealtimeProvider.test.tsx` passes its test case.

---

## Detailed Step-by-Step Implementation Plan

### Step 1: Update `src/components/providers/RealtimeProvider.tsx`
Ensure `useRealtimeContext` throws when the context is `null`.

**Proposed change in `src/components/providers/RealtimeProvider.tsx` (lines 14-16):**
```typescript
// BEFORE:
export function useRealtimeContext() {
  return useContext(RealtimeContext);
}

// AFTER:
export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (context === null) {
    throw new Error("useRealtimeContext must be used within a RealtimeProvider");
  }
  return context;
}
```

### Step 2: Refactor `src/hooks/useRealtime.ts`
Implement context subscription, fallback direct subscription, and React Query key invalidations.

**Proposed change in `src/hooks/useRealtime.ts`:**
```typescript
"use client";
import { logger } from "@/lib/logger";
import { useEffect, useRef, useContext } from "react";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { useDebouncedCallback } from "use-debounce";
import { useQueryClient, QueryClient } from "@tanstack/react-query";
import { RealtimeContext } from "@/components/providers/RealtimeProvider";

// Mapping of table changes to React Query keys that must be invalidated
const invalidateTableQueries = (table: string, queryClient: QueryClient) => {
  const tableQueryKeys: Record<string, string[][]> = {
    items: [["tasks"], ["inbox-tasks"], ["dashboard"]],
    people: [["people_minimal"], ["dashboard"]],
    threads: [["dashboard"]],
    explores: [["dashboard"]],
  };

  const keys = tableQueryKeys[table] || [];
  keys.forEach((key) => {
    logger.info(`[Realtime] Invalidating query key: ${JSON.stringify(key)} for table: ${table}`);
    queryClient.invalidateQueries({ queryKey: key });
  });
};

export function useRealtime(table: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  const queryClient = useQueryClient();
  
  // Use useContext directly to avoid throwing when outside the provider
  const context = useContext(RealtimeContext);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Consolidate updates with 200ms debounce
  const debouncedUpdate = useDebouncedCallback(() => {
    logger.info(`[Realtime] Triggering debounced update and invalidations for ${table}`);
    invalidateTableQueries(table, queryClient);
    onUpdateRef.current();
  }, 200);

  useEffect(() => {
    // Path A: Centralized Subscription via RealtimeProvider
    if (context) {
      logger.info(`[Realtime] Using RealtimeProvider context for table ${table}`);
      const unsubscribe = context.subscribe(table, debouncedUpdate);
      return unsubscribe;
    }

    // Path B: Fallback Direct Subscription (e.g., in unit tests)
    logger.info(`[Realtime] Falling back to direct subscription for table ${table}`);
    const supabase = createClient();
    
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
  }, [table, debouncedUpdate, context]);
}
```

### Step 3: Validate `src/app/(app)/layout.tsx` Layout Integration
Confirm that the layout wraps application components inside `QueryProvider` and `RealtimeProvider` in that order.

No changes are needed here, as it is already correctly implemented:
```typescript
        <QueryProvider>
          <RealtimeProvider>
            <AmbientBackground />
            <Sidebar />
            <DynamicModals />
            <RitualOverlay />
            <FAB />
            <AppContentWrapper>
              {children}
            </AppContentWrapper>
            <BottomNav />
          </RealtimeProvider>
        </QueryProvider>
```

---

## Verification Plan

### Automated Unit Tests
Run the unit test runner to verify:
1. `npx vitest run src/components/providers/__tests__/RealtimeProvider.test.tsx`
   - Verifies the centralized registry, reference counting, and unmounting logic.
   - Verifies that `useRealtimeContext` throws the custom error message when outside a provider.
2. `npx vitest run src/lib/__tests__/phase4.test.tsx`
   - Verifies the `useRealtime` hook logic (debouncing, lockout guard, fallback mode, query key invalidation) in isolation.
   - Verifies integration across Morning/Evening Rituals, Swipe-to-Delete, and Textareas.

### Manual Verification
1. Open the application.
2. Navigate between pages to verify that only a single WebSocket channel is opened per active table.
3. Perform local mutations (e.g. creating/deleting a task) and verify that no duplicate fetches or UI jumps occur (meaning the echo guard successfully locked out updates within 500ms).
4. Hide the tab / minimize the window, perform a mutation in another tab, then restore the tab. Verify that the update is buffered and immediately flushed on restore.
