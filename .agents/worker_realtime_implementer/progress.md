# progress.md
Last visited: 2026-06-29T14:31:00Z
- Caching browser-side Supabase client singleton in `src/lib/supabase.ts`.
- Implemented `RealtimeProvider.tsx` with ref counting, visibility buffering, and echo guard hoisting.
- Refactored `useRealtime` hook to consume the provider and safely fallback to standalone with try-catch query client.
- Integrated `RealtimeProvider` into layout tree in `src/app/(app)/layout.tsx`.
- Created test setup file and configured it in `vitest.config.ts` to solve `toBeInTheDocument` matcher errors.
- Verified test outcomes: 46 / 50 passed (baseline had 31 / 50 passed).
