# Plan: Phase 2 Implementation

This plan executes the milestones specified by the user for Phase 2 Implementation.

## Iteration Loop Strategy
For each implementation milestone (B2, B3, B4, B5):
1. **Explore**: Spawn Explorer to analyze the target files, determine the design details, and formulate a step-by-step modification plan.
2. **Implement**: Spawn Worker to implement the planned changes, run build and verify.
3. **Review**: Spawn Reviewer to check correctness, typescript types, edge cases, and layout compliance.
4. **Audit**: Spawn Auditor to ensure no cheating/hardcoding/facades.
5. **Gate Check**: Verify all pass criteria.

For exploration milestone B1:
- Spawn Explorer to search and report.

## Work Breakdown

### Milestone B1: Exploration
- **Objective**: Find and analyze useRealtime hooks, Supabase clients, Zustand store, and TanStack query client configuration.
- **Verification**: Explorer report containing exact file paths, current implementation details, and patterns.

### Milestone B2: Centralized RealtimeProvider
- **Objective**: Implement `RealtimeProvider` in `src/components/providers/RealtimeProvider.tsx` wrapping Layout.
- **Verification**: Subagent build/test verification, file layout check.

### Milestone B3: useRealtime Refactor
- **Objective**: Refactor `useRealtime` hook to consume provider events and call `queryClient.invalidateQueries`.
- **Verification**: Unit tests / build pass.

### Milestone B4: Echo Guard Hoisting
- **Objective**: Hoist `useAppStore.markMutation` logic into the `RealtimeProvider`.
- **Verification**: No duplicate events processed, local state updates function correctly.

### Milestone B5: E2E Verification & Hardening
- **Objective**: Wait for E2E Testing Track `TEST_READY.md`. Run tests, iterate using Explorer -> Worker -> Reviewer -> Challenger -> Auditor loop until 100% E2E tests pass.
- **Verification**: Playwright E2E tests passing.
