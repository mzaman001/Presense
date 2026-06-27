# Scope: E2E Testing for Phase 4

## Architecture
- Dual Track: E2E testing track. Derived from Phase 4 requirements.
- Independent of implementation: opaque-box tests interacting with elements through standard queries (e.g., text, labels, test IDs).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Setup & Explore | Search codebase for Phase 4 features, understand component names, and locate where hook, morning/evening ritual, swipe, and auto-grow are defined. | none | PLANNED |
| 2 | Design Test Suite | Enumerate all 40+ test cases across Tiers 1-4 for the 4 requirements. | M1 | PLANNED |
| 3 | Implement Test File | Write vitest integration test file at `src/lib/__tests__/phase4.test.tsx` using helpers. | M2 | PLANNED |
| 4 | Run & Verify | Run tests using Vitest, address failures, and ensure the test suite is fully functional. | M3 | PLANNED |
| 5 | TEST_READY.md | Write `TEST_READY.md` containing the E2E coverage checklist. | M4 | PLANNED |

## Interface Contracts
- Tests must target the components and hooks defined for Phase 4:
  - `useRealtime` hook in `src/hooks/useRealtime.ts` (or similar).
  - Ritual components/pages.
  - Swipe-to-delete lists in Inbox, Explore, and People.
  - Textarea component integrating `react-textarea-autosize`.
