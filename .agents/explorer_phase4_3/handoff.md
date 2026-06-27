# Handoff Report: Phase 4 Sunsama Rituals & UI Polish Analysis

## 1. Observation
- The Postgres update echo lockout in `src/hooks/useRealtime.ts` (lines 27-31) globally ignores all realtime changes if a local mutation happened within 2.5s.
- The `user_settings` table (defined in `supabase/migrations/001_baseline.sql:103-140`) does not contain columns for Sunsama Rituals (`last_ritual_date`, `shutdown_time`, `daily_capacity_minutes`), and the `items` table does not track task time estimates (`time_estimate_minutes`).
- There are no components or Zustand state in `src/store/useAppStore.ts` to manage daily ritual flows, steps (`MorningPlan.tsx`, `MorningCommit.tsx`, `EveningReview.tsx`, `RitualOverlay.tsx`), triggers, or sidebar buttons.
- Drag-and-drop exists in the people list (`SortablePersonRow` in `src/app/(app)/remember/people/page.tsx`), but swipe-to-delete is only present in `TaskCard.tsx` (using Framer Motion `dragX` and `onDragEnd` threshold).
- Six raw `<textarea>` tags exist in the project (e.g. in `TaskAddPanel.tsx:709`, `ExploreDrawer.tsx:257`, `AddPersonPanel.tsx:202`) that do not automatically grow to fit text.
- Running `npm run test` fails on `phase3.test.tsx` due to a missing `@testing-library/dom` module in the dev environment.

## 2. Logic Chain
- Removing the 2.5s lockout in `useRealtime.ts` prevents ignoring changes from other clients. Replacing it with a 200ms debounce refetch grouped by table prevents excessive network queries and updates the UI only after the database commits, which resolves flickers.
- Creating SQL migration `010_sunsama_ritual_settings.sql` will add the necessary columns (`last_ritual_date` as `date`, `shutdown_time` as `time`, `daily_capacity_minutes` as `integer`) to `user_settings`, and `time_estimate_minutes` to `items` for comparison against daily limits.
- Extending Zustand store `useAppStore.ts` with `activeRitual` state and navigation actions, combined with rendering a lazily loaded `<RitualOverlay />` in `DynamicModals.tsx`, creates a distraction-free step process overlay.
- Triggering the morning ritual via date checks in `AppInitializer.tsx` and the evening review via periodic minute checks against `shutdown_time` provides reliable daily automated planning guidance.
- Incorporating Framer Motion horizontal drag constraints (`drag="x"`) and delete thresholds in custom card wrappers for Inbox, Explore, and People allows consistent gestures across list views.
- Because DND-kit listeners on the sortable contacts list are bound specifically to a grab handle (`GripVertical`), horizontal swipe-to-delete gestures can be handled on the rest of the card body without event conflicts.
- Adding `react-textarea-autosize` to `package.json` allows replacing `<textarea>` elements with `<TextareaAutosize>` to handle variable text lengths cleanly.

## 3. Caveats
- Running `npm run test` fails locally due to environment dependency issues (cannot find `@testing-library/dom`). Run `npm install` prior to running the test command to verify.
- Date-based auto triggers depend on client local timezone dates (`toLocaleDateString('en-CA')`). Database columns like `last_ritual_date` should be updated with local dates to prevent timezone drift mismatch.

## 4. Conclusion
A complete implementation design has been compiled. Code changes and new component layouts have been written to `analysis.md` in the working directory. The task is ready to hand off to the Implementer agent.

## 5. Verification Method
- **DB Migration**: Verify by executing the SQL statements from `010_sunsama_ritual_settings.sql` in the Supabase console, checking that new columns are successfully added to `user_settings` and `items`.
- **Automated Ritual Triggers**: In `AppInitializer.tsx`, simulate triggering by mocking `last_ritual_date` to yesterday's date (triggers Morning Planning) and setting `shutdown_time` to 1 minute ahead of current local time (triggers Evening Review).
- **Gestures and UI**: Test swipe-to-delete gestures on mobile emulator layouts. Verify that swiping cards to the left reveals a trash icon, triggers archiving/deletion with a toast message, and supports clicking "Undo". Verify that vertical sorting in the People list does not conflict with horizontal swiping.
- **Autosize Textarea**: Open the task details panel and type a long paragraph. Verify the text box automatically expands and shrinks.
