# Phase 4 Investigation Handoff

## 1. Observation
We observed the following about the workspace:
- **`useRealtime` Hook**: Located at `src/hooks/useRealtime.ts` (lines 1-44).
  - Uses `useAppStore.getState().lastMutationAt` (line 27) and locks out updates for 2500ms (lines 28-31) before triggering `onUpdateRef.current()` (line 34).
- **Rituals Layout**:
  - `src/app/(app)/layout.tsx` (lines 1-51) currently mounts `AppInitializer` and standard page layouts but has no ritual overlay.
  - `src/components/layout/AppInitializer.tsx` (lines 1-49) applies theme/motion settings from `userSettings` but does not trigger rituals.
  - `src/components/layout/Navigation.tsx` (lines 1-300) implements sidebar settings/navigation but has no manual ritual trigger.
  - `src/store/useAppStore.ts` (lines 1-83) does not track `activeRitual` or custom capacity/ritual settings in the `UserSettings` interface.
- **Swipe-to-Delete Mechanics**:
  - `src/components/features/TaskCard.tsx` (lines 79-202) implements Framer Motion horizontal drag gestures (`drag="x"`, `dragConstraints={{ left: -120, right: 0 }}`, `SWIPE_DELETE_THRESHOLD = -80`) to delete/archive items via Supabase update and optimistic React Query updates.
  - Inbox: `src/app/(app)/inbox/page.tsx` (lines 243-294) maps items without swipe gestures.
  - Explore: `src/app/(app)/explore/page.tsx` (lines 151-190) maps items using static GlassCards.
  - People: `src/app/(app)/remember/people/page.tsx` (lines 49-98) renders sortable rows utilizing `@dnd-kit/sortable`.
- **Textarea Inputs**:
  - `TaskAddPanel.tsx` (line 709) uses a standard HTML `<textarea placeholder="Additional context..." />`.
  - `ExploreDrawer.tsx` (line 257) uses a standard HTML `<textarea placeholder="Why are you saving this? ..." />`.
  - `AddPersonPanel.tsx` (line 202) uses a standard HTML `<textarea placeholder="What do you want to remember..." />`.
  - `think/[id]/page.tsx` (line 324) uses a standard HTML `<textarea placeholder="Continue the thought..." />`.

## 2. Logic Chain
- Since Sunsama triage overlay triggers burst database updates, the immediate callback behaviour in `useRealtime` will result in multiple back-to-back refetches. Applying a debounce window (150-300ms) will consolidate these.
- Since Sunsama morning and evening flows depend on `activeRitual` state, `useAppStore` must be extended to track this state, and global components (e.g. `RitualOverlay`) must intercept layout mounting.
- Since `TaskCard` already has a tested swipe-to-delete animation, we can replicate its configuration (drag constraints, thresholds, reveal layouts) to Inbox, Explore, and People rows.
- Since standard HTML `<textarea>` inputs do not auto-size on height overflow, integrating the `react-textarea-autosize` library and replacing `<textarea>` tags with `<TextareaAutosize>` will resolve the Phase 4 auto-growing requirement.

## 3. Caveats
- Since Phase 4 components (`RitualOverlay.tsx`, `MorningPlan.tsx`, etc.) are planned but not yet implemented, our verification details rely on how the integration test suite in `src/lib/__tests__/phase4.test.tsx` should mock and verify these components post-implementation.

## 4. Conclusion
Phase 4 requirements require changes to the `useRealtime` hook, Zustand store, AppInitializer/Navigation components, lists (Inbox, Explore, People), and textareas. Implementation coordinates, DOM/RTL query targets, and test methods are mapped out in the `analysis.md` report.

## 5. Verification Method
- Inspection: Read `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\explorer_testing_phase4\analysis.md` to review components, target elements, state changes, and testing strategies.
- Running tests (when implemented):
  ```bash
  npm test src/lib/__tests__/phase4.test.tsx
  ```
