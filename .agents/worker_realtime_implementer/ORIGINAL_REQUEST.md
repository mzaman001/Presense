## 2026-06-29T14:24:27Z
Optimize `src/lib/supabase.ts`, implement centralized `RealtimeProvider` in `src/components/providers/RealtimeProvider.tsx`, refactor `src/hooks/useRealtime.ts` to consume the provider, wrap the layout tree in `src/app/(app)/layout.tsx` with `RealtimeProvider`, and verify with vitest tests.
