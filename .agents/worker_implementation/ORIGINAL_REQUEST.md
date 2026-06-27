## 2026-06-21T16:35:53Z

You are 'worker_implementation'. Your working directory is C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_implementation.
Your task is to implement the requirements for Phase 3 UI Polish & Settings Cleanup in the codebase:

1. **R1 Explore Taxonomy Overhaul**:
   - In `src/components/features/ExploreDrawer.tsx`, remove custom "Types" and "Add custom type" inputs. Lock down types to: `link`, `note`, `book`. Always render the URL input field (unconditionally) so users can attach source links to books or notes as well.
   - In `src/app/(app)/explore/page.tsx`, update filters to: All Saved, Links, Notes, Books, mapping "Notes" to `note` type. Ensure standard icons are used (`Link2`, `Lightbulb`, `BookOpen`). Map legacy types (`concept` -> note, `quote` -> note or render fallback) gracefully so legacy items do not crash.
   - In `src/components/features/SearchModal.tsx`, ensure that searching searches categories/tags:
     * Search `items` by title or category: `.or("title.ilike." + q + ",category.ilike." + q)`
     * Search `people` by name or relationship: `.or("name.ilike." + q + ",relationship.ilike." + q)`
     * Search `explores` by title or tags (using array containment): `.or("title.ilike." + q + ",tags.cs.{" + debouncedQuery + "}")` or equivalent postgrest/javascript logic.

2. **R2 Settings Declutter & Layout Fixes**:
   - In `src/components/features/SettingsModal.tsx`, remove "Routing Confidence" (and corresponding buttons), "NLP Date Parsing" (nlp_date_parsing toggle), and "People Briefings" (notif_briefing toggle) settings from the UI.
   - In `SettingsModal.tsx` Focus tab, group "Auto-start breaks" toggle inside a card container labeled "Timer Durations" along with Work Duration, Short Break, and Long Break durations. Keep "Long Break After (sessions)" in a separate card container.
   - In `src/store/useAppStore.ts`, add `settingsActiveTab?: string` and `setSettingsActiveTab: (tab: string) => void` to Zustand app state. Modify `setSettingsModalOpen` to accept an optional default tab argument and update `settingsActiveTab` accordingly:
     `setSettingsModalOpen: (open, defaultTab) => set(state => ({ isSettingsModalOpen: open, settingsActiveTab: defaultTab || state.settingsActiveTab }))`
   - In `src/components/features/SettingsModal.tsx`, bind `activeTab` to `settingsActiveTab || "account"` from store, and update tab selection to call `setSettingsActiveTab`.
   - In `src/components/layout/Navigation.tsx` (the Sidebar), wrap the user row at the bottom in a clickable button or attach an onClick handler that calls `useAppStore.getState().setSettingsModalOpen(true, "account")` to reliably open settings directly to the Profile (Account) tab. Make it look like a standard sidebar button (add appropriate hover state and styling).

3. **R3 Task Card UI Polish & Think Space Lag**:
   - In `src/components/features/TaskCard.tsx`, fix border clipping on hover by shifting `whileHover={{ y: -2 }}` to the outer `motion.div` container instead of the inner draggable `motion.div`. Fix overlapping person avatars by replacing `border-[var(--color-bg-elevated)]` with `border-[var(--color-background)]` or `border-[var(--bg-base)]` so they render a clean background-colored border.
   - In `src/store/useAppStore.ts`, add a `prefetchedThreads` record and `setPrefetchedThread` setter to cache clicked thread objects.
   - In `src/app/(app)/think/page.tsx`, when clicking or navigating to a thread, call `setPrefetchedThread` to store the thread object.
   - In `src/app/(app)/think/[id]/page.tsx`, read `prefetchedThreads` from store using `id`. Initialize thread state to this prefetched object, and set `loading` to false if prefetched data exists (avoiding a full page loader spinner).
   - In `think/[id]/page.tsx`, remove the stagger animation delay (`delay: i * 0.04`) from the entries `motion.div` elements.
   - In `think/[id]/page.tsx` thread color accent picker, replace the hover-only CSS class (`group-hover:block`) with a click-triggered popover using a local state `isColorPickerOpen`. Close the popover once a color is selected. Make it work nicely on mobile and desktop.

4. **Verify & Run Checks**:
   - Run compilation and linting checks: `npm run build` and `npm run lint`.
   - Verify layout and functionality.
   - Create a handoff report at C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_implementation\handoff.md when done.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. Do not hardcode test results, create dummy/facade implementations, or circumvent the intended task. Integrity violations will be detected by a Forensic Auditor.
