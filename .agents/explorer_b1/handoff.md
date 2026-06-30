# Handoff Report: Exploratory Analysis of Realtime & TanStack Query Usages

## Observation

1. **`useRealtime` Definition and Usages**:
   - **Definition**: Located in `src/hooks/useRealtime.ts` (lines 8-62).
     - Hook signature: `export function useRealtime(table: string, onUpdate: () => void)`
     - Uses local Supabase client: `const supabase = useMemo(() => createClient(), []);`
     - Uses a debounced callback: `useDebouncedCallback(..., 200)`
     - Sets up tab visibility handling: `window.addEventListener('visibilitychange', handleVisibility);`
     - Creates subscriptions:
       ```typescript
       const channel = supabase
         .channel(`realtime_${table}`)
         .on(
           'postgres_changes',
           { event: '*', schema: 'public', table: table },
           (payload) => {
             // Echo guard
             ...
           }
         )
         .subscribe();
       ```
   - **Usages**:
     - `src/app/(app)/do/page.tsx:191-192`
       ```typescript
       useRealtime("items", fetchTasks);
       useRealtime("people", fetchPeopleList);
       ```
     - `src/app/(app)/explore/page.tsx:168`
       ```typescript
       useRealtime("explores", fetchItems);
       ```
     - `src/app/(app)/inbox/page.tsx:165`
       ```typescript
       useRealtime("items", refetch);
       ```
     - `src/app/(app)/remember/locations/page.tsx:57`
       ```typescript
       useRealtime("locations", fetchItems);
       ```
     - `src/app/(app)/remember/people/[id]/page.tsx:102-103`
       ```typescript
       useRealtime("people", fetchPerson);
       useRealtime("items", fetchPerson);
       ```
     - `src/app/(app)/remember/people/page.tsx:250`
       ```typescript
       useRealtime("people", fetchPeople);
       ```
     - `src/app/(app)/think/[id]/page.tsx:168-169`
       ```typescript
       useRealtime("threads", fetchThread);
       useRealtime("explores", fetchThread);
       ```
     - `src/app/(app)/think/page.tsx:64`
       ```typescript
       useRealtime("threads", fetchThreads);
       ```
     - `src/app/(app)/page.tsx:232-235`
       ```typescript
       useRealtime("items", refreshData);
       useRealtime("people", refreshData);
       useRealtime("threads", refreshData);
       useRealtime("explores", refreshData);
       ```
     - `src/lib/__tests__/phase4.test.tsx:110` (test wrapper/usage).

2. **Supabase Client Initialization**:
   - **Client-Side**: `src/lib/supabase.ts` (lines 3-8):
     ```typescript
     export function createClient() {
       return createBrowserClient(
         process.env.NEXT_PUBLIC_SUPABASE_URL!,
         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
       );
     }
     ```
   - **Server-Side**: `src/lib/supabase-server.ts` (lines 4-27) using `createServerClient` and cookies helper.
   - **Realtime Channels/Subscriptions**:
     - The only active subscription mechanism in the codebase is `useRealtime` hook. No other files establish Supabase realtime channels or subscriptions directly.

3. **TanStack Query Setup & Mutation Management**:
   - **Configuration**: Configured in `src/components/layout/QueryProvider.tsx` (lines 6-24):
     - `staleTime` is set to `1000 * 60 * 5` (5 minutes).
     - `refetchOnWindowFocus` is set to `true`.
   - **Queries & Mutations**:
     - Queries are fetched using `useQuery` hooks. Active query keys include:
       - `["tasks"]` (retrieved in `do/page.tsx`)
       - `["people_minimal"]` (retrieved in `do/page.tsx`)
       - `["inbox-tasks"]` (retrieved in `inbox/page.tsx`)
       - `["dashboard"]` (retrieved in `app/page.tsx`)
     - No `useMutation` hook is used anywhere in the codebase. All mutations are performed directly using the client-side `supabase` client (e.g., `supabase.from("items").update(...)`).
     - Optimistic UI updates are managed manually via `queryClient.setQueryData`, and cache invalidation is triggered manually via `queryClient.invalidateQueries`.

4. **Zustand Store and Echo Guard Logic**:
   - **Zustand store**: `src/store/useAppStore.ts` (lines 64-65, 91-97):
     ```typescript
     lastMutations: {},
     markMutation: (table) => set((state) => {
       const now = Date.now();
       return {
         lastMutations: { ...state.lastMutations, [table || '_global']: now },
       };
     }),
     ```
   - **Echo Guard usage**: Checked inside `useRealtime.ts` (lines 45-50):
     ```typescript
     const lastMutations = useAppStore.getState().lastMutations || {};
     const lastMutationAt = Math.max(lastMutations[table] || 0, lastMutations['_global'] || 0);
     if (Date.now() - lastMutationAt < 500) {
       logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
       return;
     }
     ```
     - And marked before calling a supabase mutation:
       - `useAppStore.getState().markMutation()` or `markMutation(table)`
       - Usages found across page.tsx, TaskCard.tsx, CalendarView.tsx, TaskAddPanel.tsx, RitualOverlay.tsx, PomodoroTimer.tsx, and tests.

---

## Logic Chain

1. **Redundant Channel Subscriptions**: If multiple components call `useRealtime` for the same table (e.g., `"items"` in `inbox/page.tsx` and `do/page.tsx`), a separate WebSocket connection/channel is instantiated per component (Observation 1, 2). This creates sub-optimal resource usage and violates Phase 2 requirements.
2. **Channel Rebuilds on Tab Focus/Visibility Change**: Currently, `useRealtime` cleans up its channels when `isVisible` changes to `false` and rebuilds them when `isVisible` becomes `true` (Observation 1). The phase requirements state that tab visibility changes must not trigger a channel teardown and rebuild.
3. **Query Invalidation Hoisting**: The hook does not fetch data directly but triggers custom `onUpdate` callbacks, which then manually refetch or invalidate queries (Observation 3). Hoisting query invalidation directly into the `useRealtime` hook based on a mapping of `table -> queryKeys` simplifies pages and ensures consistent TanStack cache updates.
4. **Centralized Realtime Context**: By creating a `RealtimeProvider` wrapping the application layout, a single Supabase client can manage a channel registry and shared subscriptions, solving the single channel and visibility teardown issues while keeping the Echo Guard logic unified.

---

## Caveats

- **Test Environment Isolation**: Because tests in `phase4.test.tsx` render components outside of the main layout, they will not be wrapped in `RealtimeProvider` by default. To avoid breaking existing tests, `useRealtime` must fall back gracefully to the direct subscription model if the context is unavailable.
- **Pages with Local State**: Certain pages (e.g., `explore`, `locations`, `think`, `remember/people`) use React local state instead of TanStack Query. Therefore, the `useRealtime` hook must continue supporting the optional `onUpdate` callback in addition to the automatic query invalidation.

---

## Conclusion & Refactoring Action Plan

To proceed with the Phase 2 refactoring (Milestones B2, B3, B4), the following changes should be made:

1. **Create `src/components/providers/RealtimeProvider.tsx`**:
   - Provide a React Context `RealtimeContext` exposing a `subscribe(table, callback) => unsubscribe` function.
   - Maintain a mutable channel registry in a `ref` (`channelRegistryRef`) to count active subscriptions per table.
   - Reuse channels for duplicate table subscriptions and only execute `supabase.removeChannel` when `refCount` drops to 0.
   - Hoist the echo guard logic (retrieving `lastMutations` and `_global` lockout from Zustand) inside the provider.
   - Do not unsubscribe/re-subscribe based on page visibility changes.

2. **Wrap Application in Layout**:
   - Wrap the children in `src/app/(app)/layout.tsx` with `<RealtimeProvider>` as a child of `<QueryProvider>`.

3. **Refactor `useRealtime` Hook**:
   - Read from `useRealtimeContext`.
   - If context is present, register a listener using `subscribe(table, (payload) => debouncedUpdate())`.
   - If context is absent (e.g., in test environment), fall back to the legacy direct client-side subscription setup (with visibility changes and local echo guard checks) to preserve test suite compatibility.
   - Provide automatic query invalidation by mapping table names to the respective query keys:
     ```typescript
     const TABLE_QUERY_KEY_MAP: Record<string, string[][]> = {
       items: [["tasks"], ["inbox-tasks"], ["dashboard"]],
       people: [["people_minimal"], ["people"], ["dashboard"]],
       threads: [["threads"], ["dashboard"]],
       explores: [["explores"], ["dashboard"]],
       locations: [["locations"]],
     };
     ```
   - Keep the `onUpdate` callback parameter optional to support local state-based pages.

---

## Verification Method

1. **Unit and Integration Tests**:
   - Run `npx vitest run src/lib/__tests__/phase4.test.tsx` to verify that the refactored hook maintains 100% backward compatibility and happy-path debouncing behavior.
2. **Visual Inspection**:
   - Verify that the layout includes `RealtimeProvider` and query invalidations are triggered properly upon DB mutations.
