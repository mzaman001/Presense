# Task List — BUG-42 unsaved-changes warning

Status legend: [ ] pending · [~] in progress · [x] done

## Phase 1: Foundation
- [ ] Task 1: `useUnsavedGuard(isDirty)` hook (`src/hooks/useUnsavedGuard.ts`) — beforeunload add/remove while dirty; test `src/hooks/__tests__/useUnsavedGuard.test.tsx`
  - Acceptance: `rg 'beforeunload' src` → only the hook; dirty → defaultPrevented, clean → not
  - Verify: `npx vitest run src/hooks` + `npm run build`

## Checkpoint: hook + test green
- [ ] `npm test` (145+), `npm run build`

## Phase 2: Panel guards (Tasks 2-5 independent)
- [ ] Task 2: TaskAddPanel — snapshot baseline of non-RHF fields (subtasks, timeEstimate, linkedPeopleIds, freq, days, customRRule, customInterval, startDate) at open; handleClose warns if `isDirty || snapshotDiffers`; wire hook; extend phase4 tests
- [ ] Task 3: AddPersonPanel — snapshot `color` at open (after relationship fix-up); handleClose warns if `isDirty || colorDiffers`; wire hook; extend test
- [ ] Task 4: LocationAddPanel — wire `useUnsavedGuard(isDirty)` only (both fields RHF-registered)
- [ ] Task 5: ExploreDrawer — baseline snapshot of title/url/note/type/tags/linkedThreadId at open (add + edit); handleClose + "Discard Changes?" ConfirmModal; reset baseline after save/delete; wire hook; extend phase4 tests

## Checkpoint: BUG-42 complete
- [ ] `npm test` green, `npm run build` green
- [ ] `rg 'beforeunload' src` → exactly 1 file; `rg 'showUnsavedWarning' src` → 4 panels
- [ ] Manual sweep: 4 panels — dirty-close prompts / clean-close silent / save-then-close silent
- [ ] Commit `fix: BUG-42 ...` + docs close-out (`docs: BUG-42 close-out ...` — EXECUTION_SPEC ticket + §24.3/§24.7, DOCS_NEEDS_CODE, CONTEXT.md), push after human review
