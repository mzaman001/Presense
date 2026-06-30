## 2026-06-29T13:52:37Z

Please execute the following fixes to address the integration test failures:

1. In `src/hooks/useRealtime.ts`, optimize the query cache invalidation:
   - Move the table-to-query-key invalidation logic out of the `if (context)` block in the `debouncedUpdate` callback so it invalidates query keys in BOTH provider and standalone modes.
   - For reference, here is the current `debouncedUpdate`:
     ```typescript
     const debouncedUpdate = useDebouncedCallback((payload?: any) => {
       logger.info(`[Realtime] Triggering debounced update for ${table}`);

       if (context) {
         try {
           if (queryClient) {
             const mapping: Record<string, any[][]> = {
               items: [["tasks"], ["inbox-tasks"], ["dashboard"]],
               people: [["people_minimal"], ["people"], ["dashboard"]],
               threads: [["threads"], ["dashboard"]],
               explores: [["explores"], ["dashboard"]],
               locations: [["locations"]],
             };
             const keys = mapping[table];
             if (keys) {
               keys.forEach((queryKey) => {
                 queryClient.invalidateQueries({ queryKey });
               });
             }
           }
         } catch (e) {
         }
       }
       // ...
     ```
   - Change it so the mapping and `invalidateQueries` logic runs regardless of `context` presence (but still safely wrapped in `try/catch` and checking for `queryClient`).

2. In `src/lib/__tests__/phase4.test.tsx`, fix the failing tests:
   - Update `should render morning triage stack with overdue and inbox tasks`:
     - Render the component, use `await waitFor` to wait for the loading spinner (e.g. text containing `/Preparing/i`) to disappear, and expect the heading text to be `/Morning Planning/i` (instead of `/Sunsama morning Ritual/i`).
   - Update `should triage task to 'Do Today'`:
     - Wait for loading spinner to disappear, and search for button with name `/close/i` (instead of `/Close Ritual/i`).
   - Update `should render evening review with completed tasks count and Pomodoros tally`:
     - Wait for loading spinner to disappear, and expect heading text `/Evening Review/i` (instead of `/Sunsama evening Ritual/i`).
   - Update `should integrate react-textarea-autosize in ThreadDetailPage entry inputs`:
     - Call `vi.useRealTimers();` at the very beginning of the test block to avoid the React 19 Suspense fake timers promise-resolution timeout.

3. Run the vitest test suite to verify all 50 tests pass successfully:
   - Command: `npx vitest run src/lib/__tests__/phase4.test.tsx`
   - Command: `npx vitest run src/components/providers/__tests__/RealtimeProvider.test.tsx`

4. Report back when all tests are green.
