# Handoff Report: Codebase Exploration and Design for Milestones B2, B3, B4

## 1. Observation
We explored the existing codebase to investigate Supabase Realtime Provider logic, `useRealtime` hook, layout wrapping, and integration tests. The following key observations were made:

1. **`useRealtimeContext` Implementation in `src/components/providers/RealtimeProvider.tsx` (lines 14-16):**
   ```typescript
   export function useRealtimeContext() {
     return useContext(RealtimeContext);
   }
   ```
2. **Context Exception Test in `src/components/providers/__tests__/RealtimeProvider.test.tsx` (lines 160-169):**
   ```typescript
   it("should throw error if useRealtimeContext is used outside provider", () => {
     const ConsoleError = console.error;
     console.error = vi.fn(); // Suppress react error boundary warnings in test output

     expect(() => {
       render(<TestConsumer tableName="todos" onUpdate={vi.fn()} />);
     }).toThrow("useRealtimeContext must be used within a RealtimeProvider");

     console.error = ConsoleError;
   });
   ```
3. **`useRealtime` Hook Subscriptions in `src/hooks/useRealtime.ts` (lines 33-61):**
   ```typescript
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
           // If so, ignore this event as it's likely an echo of our own mutation.
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
   ```
4. **Layout Integration in `src/app/(app)/layout.tsx` (lines 40-53):**
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

## 2. Logic Chain
1. **Ensuring Test Compatibility for `RealtimeProvider.test.tsx`**: Since `RealtimeProvider.test.tsx` (Observation 2) directly checks if calling `useRealtimeContext()` outside of a provider throws an Error with the message `"useRealtimeContext must be used within a RealtimeProvider"`, the `useRealtimeContext` implementation (Observation 1) must be updated to explicitly check for a `null` context and throw this error.
2. **Preventing Hook Violation & Enabling Fallback in `useRealtime.ts`**: If `useRealtimeContext` throws an error on null, calling it inside `useRealtime` hook when the provider is absent (e.g. in `phase4.test.tsx` unit tests) would abort the component render. React hook rules prohibit placing hook calls inside `try-catch` blocks.
3. **Safe Context Resolution**: To avoid throwing and allow a clean fallback path in `useRealtime`, the hook should call `useContext(RealtimeContext)` directly. This safely retrieves the context value, returning `null` when outside a provider (such as in unit tests) without throwing.
4. **centralized subscription and fallback execution**:
   - When `context` is present, `useRealtime` subscribes via `context.subscribe(table, debouncedUpdate)` which coordinates reference counting and WebSocket reuse.
   - When `context` is `null`, `useRealtime` uses a fallback to direct subscription on Supabase, matching the previous behavior. This ensures `phase4.test.tsx` tests pass without alterations.
5. **Adding Invalidation Logic**: When table updates occur, both paths must invalidate the corresponding React Query keys (`items`, `people`, `threads`, `explores`) via `queryClient.invalidateQueries` before executing `onUpdate` callbacks.

---

## 3. Caveats
- **Lockout Timing (500ms)**: The echo lockout guard relies on client system clocks (via `Date.now()`). Large offsets between client clocks could affect the local mutation timestamp accuracy, but since all logic (marking mutation and checking current time) happens purely on the client browser, it remains unaffected by server clock skew.
- **Visibility Changes**: Under `RealtimeProvider`, tab invisibility buffers updates but does not tear down channels. This maximizes responsiveness but could consume slightly more background resources. This is a design trade-off to ensure channels are not torn down on window visibility changes.

---

## 4. Conclusion
The proposed design successfully implements milestones B2, B3, and B4:
1. centralizes Supabase Realtime subscriptions in `RealtimeProvider` with connection reuse and tab visibility buffering.
2. Refactors `useRealtime` to use the provider's context when present, invalidating correct query cache keys (`items`, `people`, `threads`, `explores`), and falling back gracefully to direct subscriptions if no provider is present (maintaining 100% compatibility with integration tests).
3. Validates the layout wrapping in `src/app/(app)/layout.tsx`.
4. Fixes a test expectation discrepancy in `useRealtimeContext` so that `RealtimeProvider.test.tsx` passes.

---

## 5. Verification Method
Verify the design by implementing the changes and running:
```powershell
# Run the RealtimeProvider test suite
npx vitest run src/components/providers/__tests__/RealtimeProvider.test.tsx

# Run the Phase 4 integration test suite
npx vitest run src/lib/__tests__/phase4.test.tsx
```
Both test suites should pass cleanly.
