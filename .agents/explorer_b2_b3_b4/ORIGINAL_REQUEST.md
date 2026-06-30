## 2026-06-29T08:55:24Z

Your working directory is: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\explorer_b2_b3_b4
Your parent is C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\implementation_track (Conversation ID: a12c3c2f-de27-465f-954d-c733c4c98e4e)

Please execute Codebase Exploration and Design for Milestones B2, B3, B4:
1. Design `src/components/providers/RealtimeProvider.tsx`:
   - Keep a registry of active Supabase Realtime channel subscriptions.
   - Centralize client channel subscription logic, sharing one channel per table across all hook instances.
   - Ensure channels are NOT torn down on window visibility changes.
   - Hoist the echo guard (lockout check using `useAppStore.lastMutations`) into the provider so that incoming updates within 500ms of a local mutation on that table (or `_global`) are discarded before dispatching to listeners.
2. Design the refactoring of `src/hooks/useRealtime.ts`:
   - Consume the context provided by `RealtimeProvider`.
   - Call `queryClient.invalidateQueries` for appropriate query keys when table changes occur (e.g. items -> ["tasks"], ["inbox-tasks"], ["dashboard"]; people -> ["people_minimal"], ["dashboard"]; threads -> ["dashboard"]; explores -> ["dashboard"]).
   - Preserves optimistic updates by relying on the echo guard check in the provider.
   - Maintain compatibility by falling back to direct subscription if the provider is not present (e.g., in unit tests).
3. Design layout integration in `src/app/(app)/layout.tsx`:
   - Wrap application inside `QueryProvider` using `RealtimeProvider`.
4. Inspect `src/lib/__tests__/phase4.test.tsx` to ensure unit tests can pass. Design any updates needed in tests.
5. Write your findings and a detailed step-by-step implementation plan to `analysis.md` in your working directory.
6. Deliver your final report as `handoff.md` and send a message to the parent with the path.

Do NOT modify any files yourself; you are read-only.
