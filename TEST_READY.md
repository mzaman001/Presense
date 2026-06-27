# Phase 3 Test Suite Integration - Ready for Execution

This document summarizes the comprehensive integration and E2E test suite implemented for Phase 3 requirements.

## Test Runner Commands

To execute the Phase 3 integration test suite, run:

```bash
# Run only the Phase 3 test suite
npm test src/lib/__tests__/phase3.test.tsx

# Run all tests in the project
npm test
```

---

## Phase 3 Requirements Checklist

This checklist tracks the integration tests implemented in `src/lib/__tests__/phase3.test.tsx` and their verification target behaviors.

### [ ] R1: ExploreDrawer & SearchModal
- [ ] **ExploreDrawer Preset Types**: `ExploreDrawer` dropdown lists exactly "link", "note", and "book".
- [ ] **No Custom Types**: No input or button exists inside `ExploreDrawer` to create a custom type.
- [ ] **Search by Category**: `SearchModal` returns items filtered/grouped by category (e.g. searching "study" returns matching tasks).
- [ ] **Search by Tag**: `SearchModal` queries/filters explore items by their tags (e.g. searching "productivity" returns explores with the corresponding tag).

### [ ] R2: SettingsModal
- [ ] **Blocked Settings Toggles**: "Routing Confidence", "NLP for dates", and "People Briefings" are completely hidden from the DOM.
- [ ] **Auto-start Breaks Grouping**: The "Auto-start breaks" toggle is grouped inside a "Timer Durations" layout card under the Focus tab.
- [ ] **Active Tab Default**: Settings modal automatically defaults the selected tab to the value specified in `useAppStore.getState().settingsActiveTab`.

### [ ] R3: TaskCard & Think Thread Page
- [ ] **Overlapping Avatars styling**: Avatars in `TaskCard` overlapping layout have a `border-2 border-[var(--color-bg-elevated)]` class (border matching the background).
- [ ] **No Clip on Hover**: The outer container in `TaskCard` does not set `overflow-hidden` during hover actions, preventing any clipping.
- [ ] **Think Detail Page Initializer**: Page transitions are optimized by checking `window.prefetchedThreads` and initializing state immediately to avoid lag or loaders.
- [ ] **Animation Stagger Delays**: Delays on thread list items/entries are disabled (or set to 0) to ensure snappy transitions.
- [ ] **Touch Viewport Color Picker**: On mobile / touch viewports, the color picker is triggered via click rather than relying on hover styles.

---

## Test Suite Architecture Summary

The integration tests render each component using React Testing Library (`@testing-library/react`), mocked router contexts (`next/navigation`), dynamic Supabase clients (`@/lib/supabase`), and a wrapping provider for TanStack React Query (`QueryClientProvider`). Mock states are modified prior to rendering each component to simulate user settings, auth scopes, database responses, and viewport parameters.
