# Handoff Report — Codebase Audit and UX/UI Benchmark

## 1. Observation
We directly inspected the following six files and noted the exact locations of the issues:
- **`src/app/(app)/inbox/page.tsx`**:
  - Line 54–105: Inbox space routing executes `supabase.from('items').delete()` and then inserts into `people`, `explores`, or `threads`. The undo action in line 87 queries database for the newly created item using the title and deletes it, restoring the inbox item.
  - Line 197: `opacity-100 md:opacity-0 md:group-hover:opacity-100` makes action buttons hover-only on desktop.
- **`src/components/features/CaptureModal.tsx`**:
  - Lines 36, 39, 47, 48, etc.: Strings contain ANSI decoding residues like `"Remember â†’ People"` and `Â·` and `â—¾`.
  - Line 235: `disabled={!!routedItems || isRouting}` disables input during review.
  - Lines 288-291: Timezone offset manipulation using `new Date().getTimezoneOffset() * 60000` combined with standard ISO dates.
- **`src/components/features/TaskCard.tsx`**:
  - Lines 314-318: Custom comparator runs `JSON.stringify(prevProps.task) === JSON.stringify(nextProps.task)` inside `React.memo`.
  - Line 145: Hardcoded `dragConstraints={{ left: -120, right: 0 }}`.
  - Lines 275-294: Snooze indicator is read-only on the card, with only a delete `Ã—` button to remove it.
- **`src/components/features/SettingsModal.tsx`**:
  - Lines 75-99 and 222-268: Renaming categories runs immediate database updates for items/people while global settings saves are debounced by 1000ms.
  - Lines 345-372: Actions `handleClearCompleted` and `handleClearStaleLocations` execute SQL deletes but do not trigger client-side cache refresh.
  - Lines 245-268: Auto-saving is triggered solely by `debouncedSettings` with no unload listener or manual save fallback.
- **`src/components/features/ExploreDrawer.tsx`**:
  - Lines 130-137: Custom types are appended to user settings list, creating redundant classifications matching tags.
  - Line 284: `type === 'link'` hides URL inputs for books, articles, or other explore items.
- **`src/app/(app)/think/page.tsx` & `src/app/(app)/think/[id]/page.tsx`**:
  - Lines 178-190 in `[id]/page.tsx`: Color picker is hidden under `group-hover:block`.
  - Lines 123-130 in `[id]/page.tsx`: Thread entries are appended to a JSON array and the entire array is updated in the database table `threads`.

---

## 2. Logic Chain
- **Routing & Undo Race Conditions**: Since items are physically deleted and undo relies on finding the latest matching title, any concurrent transactions or items with duplicate titles will cause the wrong items to be deleted or restored.
- **Performance Degradation**: Stringifying complex task objects in the `TaskCard` memo comparison function forces the browser to serialize JSON data on every hover, click, or scroll, spiking CPU usage on large task lists.
- **Accessibility & Mobile Blockers**: By hiding buttons behind hover classes (`md:opacity-0`) or color pickers behind `group-hover:block`, screen readers and touch devices (like mobile phones) are physically locked out of key features, failing standard WCAG guidelines.
- **Data Desynchronization**: Having two different save frequencies (immediate SQL writes for items vs. debounced client-side settings updates) means a tab close or quick navigation interrupts the saving process, creating desynchronized data references in the database.

---

## 3. Caveats
- **Verification Limits**: Visual inspection was performed statically by analyzing the React/TypeScript codebase files. We did not run the application in a local browser, so dynamic CSS styling issues and specific hydration mismatches were not verified in active execution.
- **Supabase Constraints**: It is assumed that the Supabase schema matches the queries (e.g. `items` has status column, `threads` has `entries` JSON column). Discrepancies in target database configurations could affect the severity of some issues.

---

## 4. Conclusion
The Presense codebase exhibits 18 clear UX/UI or architectural issues that introduce user friction, accessibility gaps, and data sync risks. These issues can be corrected by migrating to stable, standard patterns such as soft-deletions/state-transitions, normalized database columns, flat state lists with cache invalidation, and mobile-friendly click triggers.

---

## 5. Verification Method
- **File Inspection**: Directly inspect files `src/app/(app)/inbox/page.tsx`, `src/components/features/CaptureModal.tsx`, `src/components/features/TaskCard.tsx`, `src/components/features/SettingsModal.tsx`, `src/components/features/ExploreDrawer.tsx`, and `src/app/(app)/think/[id]/page.tsx` at the lines highlighted above.
- **Static Analysis / Linting**: Run `npm run lint` or `npx eslint` on the codebase to check for compiler errors or unused variables that could be triggered by editing these files.
- **Unit Testing**: Run `npm run test` to verify if existing test cases cover task deletion or capture modal routing behavior.
