# plan.md — Execution Plan for Phase 1 & 2 Fixes

This plan outlines the changes required to address the Phase 1 (State Reliability) and Phase 2 (Core UX Hardening) issues in the Presense application.

## Milestone 1: Phase 1 - State Reliability

### Task 1.1: Refactor Triage and Space-Routing Logic
- **Target File**: `src/app/(app)/inbox/page.tsx`
- **Current Behavior**: When routing from Inbox, the item is deleted (`delete()`) and a new row is created in the target table. On Undo, the newest row with a matching title in the target table is deleted (introducing race conditions), and the inbox item is recreated.
- **Refactoring Strategy**:
  1. Instead of deleting the item from `items`, perform a soft-deletion/state transition by updating its `status` to `'deleted'` (or `'archived'`). Let's use `'deleted'` as it is already in the check constraints.
  2. When inserting the new row into the destination table (`people`, `explores`, `threads`), return the inserted row's `id` using `.select('id').single()`.
  3. Store the inserted row's ID in the toast action or component state.
  4. On Undo, delete the target row *exactly* by its ID (resolving the race condition), and restore the inbox item's status back to `'inbox'`.
  5. Add a "Locations" option to the routing dropdown that inserts into the `locations` table (mapping item name/location) and soft-deletes the inbox item, with its corresponding Undo action.

### Task 1.2: Consolidate Category Save Operations in Settings Modal
- **Target File**: `src/components/features/SettingsModal.tsx`
- **Current Behavior**: Renaming a category updates associated items/people immediately in the database, but updates `user_settings` (categories list and colors) using a 1000ms debounce. If the user closes the modal or reloads before the debounce finishes, it creates orphaned categories without color metadata.
- **Consolidation Strategy**:
  1. Define a PostgreSQL RPC function `rename_category` that updates both `user_settings` and `items`/`people` atomically.
  2. Implement a migration to deploy the `rename_category` RPC.
  3. Refactor the `handleRename` function in `SettingsModal.tsx` to call this RPC directly instead of executing separate client-side queries and debounced settings updates.

---

## Milestone 2: Phase 2 - Core UX Hardening

### Task 2.1: Normalize UTF-8 Characters
- **Target Files**: `src/components/features/CaptureModal.tsx` and other UI files.
- **Task**: Replace all garbled ANSI characters with their normalized UTF-8 equivalents:
  - Replace `â†’` with `→`
  - Replace `Â·` with `·` (or standard bullet `•`)
  - Replace `â—¾` with `▪` or appropriate Lucide icon
  - Replace `â†»` with `⇆`
  - Replace `Ã—` with `×`

### Task 2.2: Replace custom `e.stopPropagation()` dropdowns with Ref-based Click-Outside listeners
- **Target Files**: `src/components/features/ExploreDrawer.tsx`, `src/app/(app)/inbox/page.tsx`
- **Task**:
  - Remove all inline `e.stopPropagation()` calls from dropdown buttons and items.
  - Implement a ref-based click-outside detection hook or `useEffect` inside these components. Use `ref.current.contains(event.target)` to check click boundaries and close dropdowns accordingly.
  - Refactor `src/components/ui/Dropdown.tsx` to also remove `e.stopPropagation()` and rely cleanly on its existing `containerRef` click-outside logic.

### Task 2.3: Fix `JSON.stringify` Performance Bottleneck in React.memo
- **Target File**: `src/components/features/TaskCard.tsx`
- **Task**: Refactor the custom comparator in `React.memo` to perform a shallow check of critical primitive fields and reference/shallow-array checks for arrays (like `subtasks` and `linked_people_ids`) instead of full `JSON.stringify` of the task object.

### Task 2.4: Implement Optimistic UI Updates for Snoozing and Deletions
- **Target Files**: `src/components/features/TaskCard.tsx`, `src/app/(app)/page.tsx`, `src/components/features/TaskAddPanel.tsx`
- **Task**:
  - For unsnoozing in `TaskCard.tsx`, immediately update `["tasks"]` and `["dashboard"]` query caches.
  - For card deletion in `TaskCard.tsx` (swipe to delete), immediately update `["tasks"]` and `["dashboard"]` query caches and handle Undo optimistically.
  - For delete in `TaskAddPanel.tsx`, immediately remove the item from query caches and close panel.
  - Rollback caches if Supabase operations return errors.
