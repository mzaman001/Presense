# Context - Phase 4 (Sunsama Rituals & UI Polish)

## Architecture & Codebase Index
- **`useRealtime.ts`**: `src/hooks/useRealtime.ts` (needs debouncing and refactoring to prevent redundant refetches under burst writes).
- **`useAppStore.ts`**: `src/store/useAppStore.ts` (holds application settings, needs state tracking for `activeRitual` and `userSettings`).
- **`user_settings`**: DB table. Needs migration columns: `last_ritual_date`, `shutdown_time`, `daily_capacity_minutes`.
- **`layout.tsx`**: `src/app/(app)/layout.tsx` (where the `RitualOverlay` should be integrated).
- **`RitualOverlay.tsx`**: `src/components/features/RitualOverlay.tsx` (new component).
- **`AppInitializer.tsx`**: `src/components/layout/AppInitializer.tsx` (handles auto morning/evening triggers).
- **`Navigation.tsx`**: `src/components/layout/Navigation.tsx` (handles manual morning ritual trigger).
- **Swipe-to-delete**: Currently implemented in `src/components/features/TaskCard.tsx` (needs to be generalized/applied to Inbox, Explore links, and People CRM lists).
- **Auto-growing textareas**: Replace textareas for notes/tasks with `react-textarea-autosize`.

## Constraints & Objectives
- Ensure that the E2E Test suite is created first to drive verification.
- No integrity violations or cheating. All logic must be genuine.
- The `useRealtime` hook must be fixed first to avoid issues during triage burst writes.
