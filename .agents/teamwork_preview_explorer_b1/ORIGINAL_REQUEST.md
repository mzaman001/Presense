## 2026-06-29T08:50:07Z

Act as an explorer for Phase 2 Implementation. Your task is codebase exploration:
1. Examine how `useRealtime` is currently implemented (`src/hooks/useRealtime.ts`) and find all usages of it in the project (which tables, components, and callback patterns).
2. Examine the TanStack Query client configuration (where queryClient is created, how providers are structured in `src/app/layout.tsx` or similar layout files).
3. Check `useAppStore` in `src/store/useAppStore.ts` to see how `lastMutations` and `markMutation` are implemented and used.
4. Examine how the Supabase client is initialized (e.g. in `src/lib/supabase.ts` or similar).
5. Compile your findings and provide design recommendations for the centralized `RealtimeProvider` (in `src/components/providers/RealtimeProvider.tsx`) and the refactored `useRealtime` hook, ensuring tab visibility changes do not tear down channels, and queries are invalidated properly.
6. Write your detailed analysis and report to `.agents/teamwork_preview_explorer_b1/handoff.md`.
7. When done, send a message to the caller with the path of the handoff report.
