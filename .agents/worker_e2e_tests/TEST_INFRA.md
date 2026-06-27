# Test Infrastructure Architecture

This document outlines the test infrastructure and strategies used to verify the Phase 3 requirements (R1, R2, R3) for the Presense application.

## Core Libraries

1. **Vitest**: Used as the primary test runner and mock engine, configured to use global functions and match Next.js/React environment expectations.
2. **React Testing Library (RTL)**: Used to render React components, trigger simulated user events (clicks, typing, inputs), and assert on rendered DOM structures.
3. **jsdom**: The browser environment emulation layer, simulating a real window, document, and DOM.

---

## Mocking Strategy

To achieve comprehensive integration testing without hitting real databases or APIs, we mock the application's external systems and boundaries:

### 1. Supabase Client (`@/lib/supabase`)
We mock the Supabase client creation function `createClient()` to return a query builder spy. The query builder mock is chainable and thenable, allowing components to perform queries like:
```typescript
supabase
  .from("explores")
  .select("*")
  .eq("id", 1)
  .then(({ data }) => ...)
```
This is fully simulated using a recursively returning query mock that intercepts `.then()` and returns the specified payload.

### 2. Next.js Routing (`next/navigation`)
The router mock simulates Next.js's navigation mechanisms, implementing mocks for `useRouter` and `usePathname`. This prevents components from throwing errors when attempting client-side navigation.

### 3. Media Queries (`window.matchMedia`)
Emulated on the `window` object to prevent crashes when components query user accessibility preferences (like `prefers-reduced-motion`).

### 4. Global State (`@/store/useAppStore`)
The Zustand store is manipulated directly using `useAppStore.setState()` prior to each test to configure global flags like `isSettingsModalOpen`, `isSearchModalOpen`, and custom variables like `settingsActiveTab`.

---

## Phase 3 Requirements Test Scenarios

### R1: ExploreDrawer & SearchModal
- **ExploreDrawer Preset Limitation**: Verifies that custom types are blocked and only system types (`link`, `note`, `book`) are exposed in the dropdown list.
- **SearchModal Filters**: Checks category filtering and tag searching by mocking search queries on `items` (filtered by category) and `explores` (filtered by tags).

### R2: SettingsModal
- **Removed Features**: Asserts that "Routing Confidence", "NLP for dates", and "People Briefings" are not present in the settings panel.
- **Timer Durations Card**: Asserts that "Auto-start breaks" is nested inside a container containing the text "Timer Durations".
- **Tab Defaulting**: Validates that when `settingsActiveTab` is specified in the store, that specific tab is automatically loaded.

### R3: TaskCard & Think Detail Page
- **Avatar Styling**: Checks that the avatar component has `border-[var(--color-bg-elevated)]` class names.
- **Hover Clip**: Verifies that the card container does not have `hover:overflow-hidden` classes which would clip contents on hover.
- **Prefetched Threads**: Verifies that `window.prefetchedThreads` immediately hydrates the thread detail page state, bypassing loading indicators.
- **Mobile Viewport Color Picker**: Simulates a touch environment and confirms that click events trigger the picker dropdown.
