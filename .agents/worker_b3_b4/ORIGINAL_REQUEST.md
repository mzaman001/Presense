## 2026-06-29T14:29:59Z

Implement Milestones B3 and B4:
1. Hoist the echo guard logic (mutation marking) into `src/components/providers/RealtimeProvider.tsx`.
   - Export a module-level function `markMutation(table?: string)` and `getLastMutationTime(table: string): number` from `RealtimeProvider.tsx`.
   - Expose `markMutation` in the `RealtimeContext` so components can access it.
   - Inside the provider's Supabase event handler, check `Date.now() - getLastMutationTime(table) < 500` to ignore echo events.
2. Update the Zustand store `src/store/useAppStore.ts` so that its `markMutation` action calls the exported `markMutation` from `RealtimeProvider.tsx` in addition to updating the store state. This ensures backward compatibility.
3. Refactor `useRealtime` hook in `src/hooks/useRealtime.ts` to:
   - Try to consume `useRealtimeContext()`.
   - If the context is present:
     - Register a listener using `context.subscribe(table, (payload) => debouncedUpdate(payload))`.
     - Invalidate TanStack query cache keys when a database event is received for the table. Map tables to query keys:
       - `"items"` -> `[["tasks"], ["inbox-tasks"], ["dashboard"]]`
       - `"people"` -> `[["people_minimal"], ["people"], ["dashboard"]]`
       - `"threads"` -> `[["threads"], ["dashboard"]]`
       - `"explores"` -> `[["explores"], ["dashboard"]]`
       - `"locations"` -> `[["locations"]]`
       Call `queryClient.invalidateQueries({ queryKey })` for each mapped key. Wrap `useQueryClient()` and invalidation logic safely so it doesn't crash if QueryClient is not set up in tests.
     - Call the optional `onUpdate` callback after the query invalidations.
   - If the context is NOT present (fallback path for tests):
     - Fall back to the legacy direct client-side subscription behaviour using `createClient()` from `@/lib/supabase`. Keep the tab visibility handling and direct echo guard check using Zustand's `lastMutations`.
4. Run vitest tests:
   - Run the new provider tests: `npx vitest run src/components/providers/__tests__/RealtimeProvider.test.tsx`
   - Run the existing phase 4 tests: `npx vitest run src/lib/__tests__/phase4.test.tsx`
   - Ensure all tests pass.
5. Write your handoff report to `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_b3_b4\handoff.md`.
