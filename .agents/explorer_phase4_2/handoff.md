# Handoff Report: Phase 4 Analysis (Sunsama Rituals & UI Polish)

## Observation

1. **Lockout Check in `src/hooks/useRealtime.ts`**:
   At line 24 of `src/hooks/useRealtime.ts`:
   ```typescript
   const lastMutationAt = useAppStore.getState().lastMutationAt;
   if (Date.now() - lastMutationAt < 2500) {
     logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
     return;
   }
   ```
   This prevents any database event from triggering `onUpdate` within 2.5 seconds of a local mutation.

2. **Existing Migration Schema**:
   In `supabase/migrations/001_baseline.sql` (lines 103–140), `user_settings` table does not contain ritual configuration fields. `public.items` (lines 7–30) lacks an `estimated_minutes` column.

3. **Zustand App Store**:
   In `src/store/useAppStore.ts` (lines 51–60), the interface `AppState` lacks keys/methods for orchestrating active daily rituals, current steps, focus fields, or updating/retrieving ritual states.

4. **UI Components Lacking Swipe Actions**:
   In `src/app/(app)/inbox/page.tsx`, `src/app/(app)/explore/page.tsx`, and `src/app/(app)/remember/people/page.tsx`, cards are rendered using standard `motion.div` or `GlassCard` without `drag` attributes. In `people/page.tsx` (lines 49-98), cards use `@dnd-kit/sortable` vertically with a `GripVertical` handle.

5. **Static Textareas**:
   In `TaskAddPanel.tsx` (line 709) and `ExploreDrawer.tsx` (line 257), notes inputs use standard HTML `<textarea className="input" />` elements.

6. **Vitest Execution**:
   Running `npm run test` returned:
   ```
   FAIL  src/lib/__tests__/phase3.test.tsx
   Error: Cannot find module '@testing-library/dom'
   ```
   But passed all 28 tests in `capture-router.test.ts`.

---

## Logic Chain

1. **Realtime Debouncing (Reference: Obs 1)**:
   By removing the 2.5-second lockout and debouncing the refetch call (`onUpdate`) by 400ms using `useDebouncedCallback` from `use-debounce`, we can coalesce rapid updates. This prevents UI flickering from database echoes and allows concurrent updates from other users to trigger successfully.

2. **Database Schema (Reference: Obs 2)**:
   Adding `last_ritual_date`, `shutdown_time`, and `daily_capacity_minutes` to `user_settings` is necessary to track daily completions, detect day-end thresholds, and enforce time budgets. Proposing `estimated_minutes` on `items` allows calculating total planned task minutes against `daily_capacity_minutes`.

3. **Daily Rituals State Orchestration (Reference: Obs 3, 4)**:
   Adding states (`activeRitual`, `ritualStep`, `ritualFocus`) and transitions (`startRitual`, `endRitual`, `nextRitualStep`) to the Zustand store permits global coordination. A `RitualOverlay` component rendered inside `DynamicModals.tsx` can block viewports and render step screens (Triage, Commit, Done for Morning; Reflect, Reschedule, Done for Evening) based on this state.

4. **Horizontal Swipe-to-delete (Reference: Obs 4)**:
   Horizontal swipes can be isolated from vertical sorting in the People list by applying Framer Motion's `drag="x"` to the card body container while leaving the vertical sort handle listener bound to `GripVertical`. The swipe handler can trigger optimistic cache updates, trigger deletions in Supabase, and issue `sonner` undo notifications.

5. **Flexible Inputs (Reference: Obs 5)**:
   Installing `"react-textarea-autosize"` and replacing standard `<textarea>` elements with `<TextareaAutosize className="input resize-none" minRows={3} />` provides modern, auto-growing notes fields without breaking styles.

---

## Caveats

- **Vitest Node Modules Issue (Reference: Obs 6)**: The Vitest suite fails to run `phase3.test.tsx` because `@testing-library/dom` is not found, although listed in devDependencies. The implementing agent must run `npm install` before testing.
- **Evening Review Storage**: Since there is no `last_evening_review_date` database field, we assume storing evening completions in `localStorage` is sufficient.

---

## Conclusion

The analysis is complete, and the design for Phase 4 is fully detailed in `analysis.md`. The proposed fixes and new components are structured, verified against current code patterns, and ready for implementation.

No code modifications were made. The implementation agent can apply the proposed designs directly:
- Apply SQL changes in a new migration `010_sunsama_rituals.sql`.
- Update `src/hooks/useRealtime.ts` with the debounced implementation.
- Expand Zustand store in `src/store/useAppStore.ts`.
- Build Sunsama UI components in `src/components/features/` and wire triggers.
- Apply swipe-to-delete animations and swap textareas with `react-textarea-autosize`.

---

## Verification Method

- Run `./scripts/run_migrations.ps1` to apply SQL changes.
- Open the application and verify that daily rituals auto-trigger based on `last_ritual_date` and the current time of day.
- Verify swipe-to-delete functionality works with undo toasts in Inbox, Explore, and People views.
- Run tests via `vitest run` once dependencies are installed.
