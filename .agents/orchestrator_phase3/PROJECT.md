# Project: Phase 3 (UI Polish & Settings Cleanup)

## Architecture
- **Explore Taxonomy**: Lock down the allowed explore types to a fixed list: `link`, `note`, `book`. Standardize icons and disable custom type creation. Update tags and category search in `SearchModal`.
- **Settings & Sidebar Navigation**: Streamline settings toggles. Re-layout Focus tab durations and auto-start breaks. Add default selected tab mechanism in store, wire sidebar profile click to Account tab.
- **TaskCard & Think Thread UI**: Fix border clipping by shifting layout hover transformations and styling overlapping avatars with `border-[var(--color-background)]`. Optimize Think thread details page by using prefetched store state and removing animation stagger delay to resolve page lag.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | E2E Test Suite | Design and implement an opaque-box test suite for R1, R2, R3 in `src/lib/__tests__` or similar | None | PLANNED |
| 2 | Explore Taxonomy Overhaul | Lock down types, update explore page and search tags/categories in search modal | M1 | PLANNED |
| 3 | Settings & Sidebar | Remove clean settings toggles, re-layout focus tab, link sidebar profile button to Account tab | M1 | PLANNED |
| 4 | TaskCard & Think Space | Fix TaskCard borders, overlapping avatars, think thread details prefetching, and color picker | M1 | PLANNED |
| 5 | Verification & Hardening | Run E2E tests, execute adversarial checks and audit using Forensic Auditor | M2, M3, M4 | PLANNED |

## Interface Contracts
- **useAppStore**:
  - `settingsActiveTab`: string (representing tab id to open modal to, e.g. "account")
  - `setSettingsActiveTab`: (tab: string) => void
  - `prefetchedThreads`: Record<string, Thread> (cached thread records to bypass loading spinners)
  - `setPrefetchedThread`: (id: string, data: Thread) => void
- **SettingsModal**:
  - Controlled activeTab linked to store `settingsActiveTab` state for external tab selection.
- **Explore Types**:
  - Standardized types: `link` (Link), `note` (Note), `book` (Book).

## Code Layout
- `src/components/features/ExploreDrawer.tsx` — Explore item edit/create form.
- `src/components/features/SettingsModal.tsx` — Settings tabs and fields.
- `src/components/features/TaskCard.tsx` — Task card component.
- `src/components/features/SearchModal.tsx` — Search dialog for all spaces.
- `src/components/layout/Navigation.tsx` — App sidebar containing user avatar.
- `src/app/(app)/think/[id]/page.tsx` — Think thread detail view.
- `src/app/(app)/explore/page.tsx` — Explore list page.
- `src/store/useAppStore.ts` — Zustand store for app state.
