## 2026-06-29T08:58:46Z
Your working directory is: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_b2_b3_b4
Your parent is C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\implementation_track (Conversation ID: a12c3c2f-de27-465f-954d-c733c4c98e4e)

Please execute the implementation of Milestones B2, B3, B4:

1. Update `src/components/providers/RealtimeProvider.tsx`:
   - Change `useRealtimeContext` implementation to:
     ```typescript
     export function useRealtimeContext() {
       const context = useContext(RealtimeContext);
       if (context === null) {
         throw new Error("useRealtimeContext must be used within a RealtimeProvider");
       }
       return context;
     }
     ```

2. Refactor `src/hooks/useRealtime.ts`:
   - Import `useContext` from "react".
   - Import `useQueryClient, QueryClient` from "@tanstack/react-query".
   - Import `RealtimeContext` from "@/components/providers/RealtimeProvider".
   - Create a mapping/helper to invalidate query cache keys when database changes occur:
     - `items` -> `["tasks"]`, `["inbox-tasks"]`, `["dashboard"]`
     - `people` -> `["people_minimal"]`, `["dashboard"]`
     - `threads` -> `["dashboard"]`
     - `explores` -> `["dashboard"]`
   - Use `useContext(RealtimeContext)` directly inside `useRealtime` hook (do not call `useRealtimeContext` to avoid throwing when outside the provider, e.g. in integration tests).
   - If `context` is present:
     - Subscribe via `context.subscribe(table, debouncedUpdate)`.
   - If `context` is `null` (fallback path):
     - Log fallback mode.
     - Fall back to the original direct Supabase channel subscription.
   - The debounced update function (`debouncedUpdate`) should:
     - Call the invalidation helper to invalidate query keys.
     - Call the user-provided `onUpdate` callback.

3. Run the unit test suites to verify that both the provider and the integration tests pass successfully:
   - Command: `npx vitest run src/components/providers/__tests__/RealtimeProvider.test.tsx`
   - Command: `npx vitest run src/lib/__tests__/phase4.test.tsx`

4. Report the build and test outcomes in your handoff report.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
