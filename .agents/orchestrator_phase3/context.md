# Context — Phase 3 (UI Polish & Settings Cleanup)

## System Status & Settings
- DB Table `explores` contains `type` (text), `tags` (text[]), and `status` (text).
- DB Table `user_settings` contains `explore_custom_types` (text[]) which is now deprecated.
- DB Table `threads` contains `entries` (jsonb[]).

## Key Files to Modify
1. **Explore Taxonomy (R1)**:
   - `src/components/features/ExploreDrawer.tsx` (lock preset types to link, note, book; remove custom types)
   - `src/app/(app)/explore/page.tsx` (standardize filters and icons)
   - `src/components/features/SearchModal.tsx` (allow category and tag search)
2. **Settings Declutter (R2)**:
   - `src/components/features/SettingsModal.tsx` (remove NLP date, routing confidence, people briefing; re-layout Focus tab)
   - `src/components/layout/Navigation.tsx` (click sidebar user row to open settings modal account/profile tab)
   - `src/store/useAppStore.ts` (store tab state `settingsActiveTab`, `setSettingsActiveTab`)
3. **Task Card & Think Space (R3)**:
   - `src/components/features/TaskCard.tsx` (parent whileHover translation to avoid border clipping, fix avatar border to `var(--color-background)`)
   - `src/app/(app)/think/[id]/page.tsx` (prefetched data hook from store, disable stagger delay, click-to-toggle mobile color picker)
   - `src/app/(app)/think/page.tsx` (click thread handler setting store `prefetchedThreads` cache)
